import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const stubs = vi.hoisted(() => ({ read: vi.fn(), createClient: vi.fn(), auth: vi.fn(), from: vi.fn(), storage: vi.fn(), parse: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: stubs.createClient }));
vi.mock("@/lib/ai/read-screenshot", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/ai/read-screenshot")>()), readScreenshot: stubs.read }));
vi.mock("@/lib/ai/parse-ride-post", () => ({ parseRidePost: stubs.parse }));

import { POST } from "./route";
import { ScreenshotReaderError } from "@/lib/ai/read-screenshot";
import { MAX_SCREENSHOT_BYTES } from "@/lib/ai/screenshot-contract";
const posts = [{ text: "Bitola - Skopje utre 08:30", kind: "offer", confidence: 0.9 }];
const request = () => {
  const form = new FormData();
  form.set("image", new File([new Uint8Array([1, 2, 3])], "post.png", { type: "image/png" }));
  return new Request("http://localhost/api/parse/screenshot", { method: "POST", body: form });
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AI_IMPORT_PIPELINE_ENABLED", "true");
  stubs.auth.mockResolvedValue({ data: { user: { id: "driver" } } });
  stubs.createClient.mockResolvedValue({ auth: { getUser: stubs.auth }, from: stubs.from, storage: { from: stubs.storage } });
  stubs.read.mockResolvedValue({ posts });
});
afterEach(() => vi.unstubAllEnvs());
describe("screenshot endpoint", () => {
  it.each([undefined, "false", "invalid", "TRUE"])("disables stale-client uploads before auth or body processing when flag is %s", async flag => {
    vi.stubEnv("AI_IMPORT_PIPELINE_ENABLED", flag);
    const upload = request();
    const body = vi.spyOn(upload, "formData");
    const response = await POST(upload);
    expect(response.status).toBe(404);
    expect(body).not.toHaveBeenCalled();
    expect(stubs.createClient).not.toHaveBeenCalled();
    expect(stubs.read).not.toHaveBeenCalled();
  });

  it("requires authentication before reading a multipart body", async () => {
    stubs.auth.mockResolvedValue({ data: { user: null } });
    const upload = request();
    const body = vi.spyOn(upload, "formData");
    expect((await POST(upload)).status).toBe(401);
    expect(body).not.toHaveBeenCalled();
    expect(stubs.read).not.toHaveBeenCalled();
  });

  it("returns only detected posts without parsing, inserts, or storage", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ posts });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(stubs.read).toHaveBeenCalledWith({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" });
    expect(stubs.from).not.toHaveBeenCalled();
    expect(stubs.storage).not.toHaveBeenCalled();
    expect(stubs.parse).not.toHaveBeenCalled();
  });

  it.each(["missing", "url", "multiple", "other-file"])("rejects %s form data", async kind => {
    const form = new FormData();
    const file = new File([new Uint8Array([1])], "image.png", { type: "image/png" });
    if (kind === "url") form.set("image", "https://example.test/remote.png");
    if (kind === "multiple") { form.append("image", file); form.append("image", file); }
    if (kind === "other-file") { form.set("image", file); form.set("extra", file); }
    const upload = new Request("http://localhost/api/parse/screenshot", { method: "POST", body: form });
    expect((await POST(upload)).status).toBe(400);
    expect(stubs.read).not.toHaveBeenCalled();
  });

  it.each(["unsupported", "oversized", "empty"])("rejects %s files before their bytes are read", async kind => {
    const size = kind === "oversized" ? MAX_SCREENSHOT_BYTES + 1 : kind === "empty" ? 0 : 1;
    const file = new File([new Uint8Array(size)], "image", { type: kind === "unsupported" ? "image/gif" : "image/png" });
    const bytes = vi.spyOn(file, "arrayBuffer");
    const form = new FormData(); form.set("image", file);
    const upload = request(); vi.spyOn(upload, "formData").mockResolvedValue(form);
    expect((await POST(upload)).status).toBe(400);
    expect(bytes).not.toHaveBeenCalled();
    expect(stubs.read).not.toHaveBeenCalled();
  });

  it("accepts an exactly-at-limit upload", async () => {
    const form = new FormData(); form.set("image", new File([new Uint8Array(MAX_SCREENSHOT_BYTES)], "image.webp", { type: "image/webp" }));
    const upload = request(); vi.spyOn(upload, "formData").mockResolvedValue(form);
    expect((await POST(upload)).status).toBe(200);
    expect(stubs.read.mock.calls[0][0].bytes.byteLength).toBe(MAX_SCREENSHOT_BYTES);
  });

  it("rejects non-multipart and broken multipart requests", async () => {
    const json = new Request("http://localhost/api/parse/screenshot", { method: "POST", body: JSON.stringify({ image: "https://example.test" }), headers: { "content-type": "application/json" } });
    const body = vi.spyOn(json, "formData");
    expect((await POST(json)).status).toBe(400);
    expect(body).not.toHaveBeenCalled();
    const broken = request(); vi.spyOn(broken, "formData").mockRejectedValue(new Error("Malformed"));
    expect((await POST(broken)).status).toBe(400);
    expect(stubs.read).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid_input", 400], ["missing_key", 503], ["refusal", 422], ["provider_error", 502], ["unreadable", 422],
  ] as const)("maps %s reader failures to HTTP %s without persistence", async (code, status) => {
    const message = code === "unreadable" ? "Couldn't read this screenshot, paste the text instead" : "Readable error";
    stubs.read.mockRejectedValue(new ScreenshotReaderError(message, code));
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message, code });
    expect(stubs.from).not.toHaveBeenCalled();
    expect(stubs.storage).not.toHaveBeenCalled();
  });

  it("does not expose unexpected provider exception details", async () => {
    stubs.read.mockRejectedValue(new Error("secret provider details"));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret provider details");
  });
});
