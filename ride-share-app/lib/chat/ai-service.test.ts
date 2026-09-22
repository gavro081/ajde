import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), transcript: vi.fn(), model: vi.fn(), permit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ roomAccess: mocks.access }));
vi.mock("./transcript", async original => ({ ...await original<typeof import("./transcript")>(), loadTranscript: mocks.transcript }));
vi.mock("@/lib/ai/chat-assistant", async original => ({ ...await original<typeof import("@/lib/ai/chat-assistant")>(), runChatAssistant: mocks.model }));
import { assistRoom } from "./ai-service";
import { TranscriptTooLarge } from "./transcript";
import { ChatAiError } from "@/lib/ai/chat-assistant";
const rideId = "94000000-0000-4000-8000-000000000001";
const msg = { id: "94000000-0000-4000-8000-000000000010", created_at: "2026-09-21T12:00:00Z", author: "Ana", body: "Meet at 17:30" };
const access = { ok: true, user: { id: "member" }, supabase: { rpc: mocks.permit } };
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  mocks.access.mockReset().mockResolvedValue(access);
  mocks.transcript.mockReset().mockResolvedValue({ messages: [msg], cutoff: { id: msg.id, created_at: msg.created_at } });
  mocks.permit.mockReset().mockResolvedValue({ data: true, error: null });
  mocks.model.mockReset().mockResolvedValue({ insufficientEvidence: false, items: [{ category: "decision", text: "Meet at 17:30", messageIds: [msg.id] }] });
});
afterEach(() => vi.unstubAllEnvs());
describe("private AI service", () => {
  it.each(["summary", "question"] as const)("grounds %s using server history and builds real source excerpts", async mode => {
    const request = mode === "summary" ? { rideId, mode } : { rideId, mode, question: " When? " };
    const result = await assistRoom(request);
    expect(result).toMatchObject({ ok: true, value: { mode, messageCount: 1, items: [{ sources: [msg] }] } });
    expect(mocks.access).toHaveBeenCalledTimes(3);
    expect(mocks.permit).toHaveBeenCalledWith("try_chat_ai_request");
    expect(mocks.model).toHaveBeenCalledWith(mode === "summary" ? request : { ...request, question: "When?" }, [msg], undefined);
  });
  it.each([{ messages: [msg] }, { userId: "forged" }, { mode: "question", question: " " }, { mode: "question", question: "a".repeat(1001) }, { rideId: "bad" }])("rejects invalid/forged input", async extra => {
    expect(await assistRoom({ rideId, mode: "summary", ...extra })).toMatchObject({ ok: false, code: "invalid" });
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("denies other-room and non-member requests before reading or calling the model", async () => {
    mocks.access.mockResolvedValue({ ok: false, code: "unavailable" });
    expect(await assistRoom({ rideId, mode: "summary" })).toMatchObject({ ok: false, code: "unavailable" });
    expect(mocks.transcript).not.toHaveBeenCalled(); expect(mocks.model).not.toHaveBeenCalled();
  });
  it.each([2, 3])("drops output when authorization is lost at check %s", async check => {
    for (let i = 1; i < check; i++) mocks.access.mockResolvedValueOnce(access);
    mocks.access.mockResolvedValueOnce({ ok: false, code: "unavailable" });
    expect(await assistRoom({ rideId, mode: "summary" })).toMatchObject({ ok: false, code: "unavailable" });
    expect(mocks.model).toHaveBeenCalledTimes(check === 3 ? 1 : 0);
  });
  it("rejects a changed account even if it too is a member", async () => {
    mocks.access.mockResolvedValueOnce(access).mockResolvedValueOnce({ ...access, user: { id: "another" } });
    expect(await assistRoom({ rideId, mode: "summary" })).toMatchObject({ ok: false, code: "unavailable" });
    expect(mocks.model).not.toHaveBeenCalled();
  });
  it("avoids a paid request for empty, oversized or failed history", async () => {
    mocks.transcript.mockResolvedValueOnce({ messages: [], cutoff: null });
    expect(await assistRoom({ rideId, mode: "summary" })).toMatchObject({ code: "empty" });
    mocks.transcript.mockRejectedValueOnce(new TranscriptTooLarge());
    expect(await assistRoom({ rideId, mode: "summary" })).toMatchObject({ code: "too_large" });
    mocks.transcript.mockRejectedValueOnce(new Error());
    expect(await assistRoom({ rideId, mode: "summary" })).toMatchObject({ code: "database" });
    expect(mocks.permit).not.toHaveBeenCalled(); expect(mocks.model).not.toHaveBeenCalled();
  });
  it("checks configuration and the database budget before the provider", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await assistRoom({ rideId, mode: "summary" })).toMatchObject({ code: "missing_key" });
    vi.stubEnv("OPENAI_API_KEY", "test-only"); mocks.permit.mockResolvedValueOnce({ data: false, error: null });
    expect(await assistRoom({ rideId, mode: "summary" })).toMatchObject({ code: "rate_limit" });
    mocks.permit.mockResolvedValueOnce({ data: null, error: {} });
    expect(await assistRoom({ rideId, mode: "summary" })).toMatchObject({ code: "database" });
    expect(mocks.model).not.toHaveBeenCalled();
  });
  it.each([{ messageIds: [] }, { messageIds: ["94000000-0000-4000-8000-000000009999"] }])("rejects missing or invented citations", async ({ messageIds }) => {
    mocks.model.mockResolvedValue({ insufficientEvidence: false, items: [{ category: "information", text: "Invented", messageIds }] });
    expect(await assistRoom({ rideId, mode: "summary" })).toMatchObject({ code: "invalid_output" });
  });
  it("represents insufficient evidence without an uncited answer", async () => {
    mocks.model.mockResolvedValue({ insufficientEvidence: true, items: [] });
    expect(await assistRoom({ rideId, mode: "question", question: "How much luggage?" })).toMatchObject({ ok: true, value: { insufficientEvidence: true, items: [] } });
    mocks.model.mockResolvedValue({ insufficientEvidence: false, items: [] });
    expect(await assistRoom({ rideId, mode: "summary" })).toMatchObject({ code: "invalid_output" });
  });
  it.each(["timeout", "provider", "refusal", "invalid_output"] as const)("returns explicit %s failure", async code => {
    mocks.model.mockRejectedValue(new ChatAiError(code));
    expect(await assistRoom({ rideId, mode: "summary" })).toMatchObject({ ok: false, code });
  });
});
