vi.mock("server-only", () => ({}));
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const service = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/ai-service", () => ({ assistRoom: service, aiFailure: (code: string) => ({ ok: false, code, error: code }) }));
import { POST } from "./route";
const url = "https://rides.example/api/chat/assist";
const request = (body: string, origin = "https://rides.example") => new Request(url, { method: "POST", body, headers: { origin } });
beforeEach(() => { vi.stubEnv("CHAT_AI_ENABLED", "true"); service.mockReset().mockResolvedValue({ ok: false, code: "rate_limit", error: "Retry" }); });
afterEach(() => vi.unstubAllEnvs());
it("rejects cross-site requests, invalid JSON, and excessive bodies before service access", async () => {
  expect((await POST(request("{}", "https://evil.example"))).status).toBe(403);
  expect((await POST(request("{"))).status).toBe(400);
  expect((await POST(request(" ".repeat(8193)))).status).toBe(413);
  expect(service).not.toHaveBeenCalled();
});
it("returns private no-store errors with retry metadata and forwards the abort signal", async () => {
  const req = request('{}'); const response = await POST(req);
  expect(response.status).toBe(429);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("retry-after")).toBe("60");
  expect(service).toHaveBeenCalledWith({}, req.signal);
});

it("blocks disabled AI before calling the service", async () => {
  vi.stubEnv("CHAT_AI_ENABLED", "false");
  const response = await POST(request("{}"));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ ok: false, code: "disabled" });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(service).not.toHaveBeenCalled();
});
