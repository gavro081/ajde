import { afterEach, describe, expect, it, vi } from "vitest";
import { readScreenshot, ScreenshotReaderError } from "./read-screenshot";
import { MAX_SCREENSHOT_BYTES } from "./screenshot-contract";

vi.mock("server-only", () => ({}));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const image = { bytes: new Uint8Array([137, 80, 78, 71]), mimeType: "image/png" };
describe("readScreenshot", () => {
  it("preserves transcription characters while returning selectable offer, request, and other posts", async () => {
    const posts = [
      { text: "  Битола → Skopje utre 08:30 🚗\n3 mestaa [?]  ", kind: "offer", confidence: 0.85 },
      { text: "Baram prevoz?", kind: "request", confidence: 0.7 },
      { text: "fala! 🙂", kind: "other", confidence: 0.9 },
    ];
    const runner = vi.fn(async () => ({ legible: true, posts }));
    expect(await readScreenshot(image, { modelRunner: runner })).toEqual({ posts });
    expect(runner).toHaveBeenCalledWith({ imageDataUrl: "data:image/png;base64,iVBORw==" });
  });

  it.each(["image/gif", "image/svg+xml", "text/plain", ""])("rejects unsupported MIME %s before model invocation", async mimeType => {
    const runner = vi.fn();
    await expect(readScreenshot({ ...image, mimeType }, { modelRunner: runner })).rejects.toMatchObject({ code: "invalid_input" });
    expect(runner).not.toHaveBeenCalled();
  });

  it.each([0, MAX_SCREENSHOT_BYTES + 1])("rejects invalid byte length %s before invoking a model", async byteLength => {
    const runner = vi.fn();
    await expect(readScreenshot({ ...image, bytes: new Uint8Array(byteLength) }, { modelRunner: runner })).rejects.toMatchObject({ code: "invalid_input" });
    expect(runner).not.toHaveBeenCalled();
  });

  it.each(["image/png", "image/jpeg", "image/webp"])("accepts exactly 4 MiB for %s", async mimeType => {
    const runner = vi.fn(async () => ({ legible: true, posts: [{ text: "An offer", kind: "offer", confidence: 1 }] }));
    expect((await readScreenshot({ mimeType, bytes: new Uint8Array(MAX_SCREENSHOT_BYTES) }, { modelRunner: runner })).posts).toHaveLength(1);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("filters empty posts before retaining the first ten without altering retained text", async () => {
    const posts = Array.from({ length: 12 }, (_, i) => ({ text: ` post ${i} `, kind: "other", confidence: 0.5 }));
    const result = await readScreenshot(image, { modelRunner: async () => ({ legible: true, posts: [{ text: " \n\t ", kind: "other", confidence: 0 }, ...posts] }) });
    expect(result.posts).toEqual(posts.slice(0, 10));
  });

  it.each([
    { legible: false, posts: [{ text: "Something", kind: "other", confidence: 0.1 }] },
    { legible: true, posts: [] },
    { legible: true, posts: [{ text: " \n\t ", kind: "other", confidence: 0 }] },
  ])("returns the typed paste-text fallback for illegible or empty output", async output => {
    await expect(readScreenshot(image, { modelRunner: async () => output })).rejects.toMatchObject({ code: "unreadable", message: "Couldn't read this screenshot, paste the text instead" });
  });

  it.each([
    null, {}, { legible: true, posts: [{ text: "x".repeat(5001), kind: "offer", confidence: 0.8 }] },
    { legible: true, posts: [{ text: "Post", kind: "offer", confidence: 1.1 }] },
    { legible: true, posts: [{ text: "Post", kind: "offer", confidence: -0.1 }] },
    { legible: true, posts: [{ text: "Post", kind: "ride", confidence: 0.5 }] },
  ])("rejects malformed structured output", async output => {
    await expect(readScreenshot(image, { modelRunner: async () => output })).rejects.toMatchObject({ code: "provider_error" });
  });

  it("accepts a 5000-character transcript exactly", async () => {
    const text = "x".repeat(5000);
    expect((await readScreenshot(image, { modelRunner: async () => ({ legible: true, posts: [{ text, kind: "other", confidence: 0 }] }) })).posts[0].text).toBe(text);
  });

  it("requires credentials only for the production runner", async () => {
    vi.stubEnv("OPENAI_API_KEY", " ");
    await expect(readScreenshot(image)).rejects.toMatchObject({ code: "missing_key" });
    expect((await readScreenshot(image, { modelRunner: async () => ({ legible: true, posts: [{ text: "Offer", kind: "offer", confidence: 1 }] }) })).posts).toHaveLength(1);
  });

  it("returns a typed provider error without propagating provider details", async () => {
    await expect(readScreenshot(image, { modelRunner: async () => { throw new Error("private provider body or timeout"); } })).rejects.toMatchObject({ code: "provider_error", message: "The screenshot reading service could not complete this request. Try again or paste the text." });
    await expect(readScreenshot(image, { modelRunner: async () => { throw new ScreenshotReaderError("Refused", "refusal"); } })).rejects.toMatchObject({ code: "refusal" });
  });

  it.each([[" configured-image-model ", "configured-image-model"], ["", "gpt-5.4-mini"]])("uses a server-created high-detail image with verified model configuration", async (configured, expected) => {
    vi.stubEnv("OPENAI_API_KEY", "fake-test-key");
    vi.stubEnv("OPENAI_MODEL", configured);
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ id: "reader-response", object: "response", status: "completed", output: [{ id: "message", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify({ legible: true, posts: [{ text: "Bitola ride", kind: "offer", confidence: 0.8 }] }), annotations: [] }] }] }), { headers: { "content-type": "application/json" } });
    }));
    expect((await readScreenshot(image)).posts[0].text).toBe("Bitola ride");
    expect(requests[0]).toMatchObject({ model: expected, store: false, input: [{ role: "user", content: [expect.anything(), { type: "input_image", detail: "high", image_url: "data:image/png;base64,iVBORw==" }] }] });
  });

  it("maps an actual SDK refusal to the typed refusal error", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fake-test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "reader-response", object: "response", status: "completed", output: [{ id: "message", type: "message", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "Cannot process this image" }] }] }), { headers: { "content-type": "application/json" } })));
    await expect(readScreenshot(image)).rejects.toMatchObject({ code: "refusal" });
  });

  it("does not retry provider failures", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fake-test-key");
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Provider unavailable" } }), { status: 503, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    await expect(readScreenshot(image)).rejects.toMatchObject({ code: "provider_error" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
