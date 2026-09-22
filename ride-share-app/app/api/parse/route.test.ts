import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const stubs = vi.hoisted(() => ({ user: { id: "driver" } as { id: string } | null, parse: vi.fn(), check: vi.fn(), insert: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: stubs.user } }) }, from: stubs.from,
}) }));
vi.mock("@/lib/ai/parse-ride-post", () => ({ parseRidePost: stubs.parse, RideParserError: class extends Error {} }));
vi.mock("@/lib/ai/openai-location-fallback", () => ({ createOpenAILocationFallback: () => undefined }));
vi.mock("@/lib/ai/check-ride-draft", () => ({ checkRideDraft: stubs.check }));

import { emptyOfferDraft } from "@/lib/rides/offer-interpretation";
import { parsedRidePostSchema, type ParsedRidePost } from "@/lib/ai/parsed-ride-post";
import { POST } from "./route";

const importId = "10000000-0000-4000-8000-000000000001";
const parsed = (): ParsedRidePost => ({ classification: "offer", sourceLanguage: "mk", draft: {
  ...emptyOfferDraft(), source: "imported", confidence: 0.8,
  origin: { cityId: 1, pickupPointId: null, rawText: "Skopje" },
  destination: { cityId: 2, pickupPointId: null, rawText: "Veles" },
} });
const request = (extra = {}) => new Request("http://localhost/api/parse", {
  method: "POST", body: JSON.stringify({ text: "Skopje Veles tomorrow 17h", sourceHint: "other", ...extra }),
});

beforeEach(() => {
  vi.resetAllMocks();
  stubs.user = { id: "driver" };
  stubs.parse.mockResolvedValue(parsed());
  stubs.check.mockImplementation(async (value: ParsedRidePost) => ({ parsed: { ...value, draft: { ...value.draft, distanceKm: 52 } }, status: "checked", trace: [{ callId: "road-1", tool: "road_distance", args: { originCityId: 1, destinationCityId: 2 }, result: { distanceKm: 52 } }] }));
  stubs.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: importId }, error: null }) }) });
  stubs.from.mockImplementation((table: string) => table === "imports" ? { insert: stubs.insert } : { select: async () => ({ data: table === "cities" ? [
    { id: 1, name_en: "Skopje", name_mk: "Скопје", aliases: [] },
    { id: 2, name_en: "Veles", name_mk: "Велес", aliases: [] },
  ] : [], error: null }) });
});
afterEach(() => vi.unstubAllEnvs());

it.each([undefined, "false", "invalid"])("preserves text importing without check metadata when flag is %s", async flag => {
  vi.stubEnv("AI_IMPORT_PIPELINE_ENABLED", flag);
  const response = await POST(request({ pipelineEnabled: true }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ importId, parsed: parsed() });
  expect(stubs.check).not.toHaveBeenCalled();
  expect(stubs.insert.mock.calls[0][0].parsed_json).toEqual(parsed());
});

it("checks an offer after existing warnings and saves/returns compatible metadata", async () => {
  vi.stubEnv("AI_IMPORT_PIPELINE_ENABLED", "true");
  const original = parsed(); original.draft.confidence = 0.3;
  stubs.parse.mockResolvedValue(original);
  const response = await POST(request());
  const result = await response.json();
  expect(response.status).toBe(200);
  expect(stubs.check.mock.calls[0][0].draft.warnings).toEqual([expect.objectContaining({ code: "low_confidence" })]);
  expect(result.parsed.draft.distanceKm).toBe(52);
  expect(result.check).toMatchObject({ status: "checked", trace: [{ tool: "road_distance" }] });
  const saved = stubs.insert.mock.calls[0][0];
  expect(saved.raw_text).toBe("Skopje Veles tomorrow 17h");
  expect(saved.parsed_json).toEqual({ ...result.parsed, check: result.check });
  vi.stubEnv("AI_IMPORT_PIPELINE_ENABLED", "false");
  expect(parsedRidePostSchema.parse(saved.parsed_json)).toEqual(result.parsed);
});

it.each(["request", "unknown"] as const)("does not claim checks for %s", async classification => {
  vi.stubEnv("AI_IMPORT_PIPELINE_ENABLED", "true");
  stubs.parse.mockResolvedValue({ ...parsed(), classification });
  const result = await (await POST(request())).json();
  expect(result).not.toHaveProperty("check");
  expect(stubs.check).not.toHaveBeenCalled();
});

it("requires authentication before parsing or persistence", async () => {
  stubs.user = null;
  expect((await POST(request())).status).toBe(401);
  expect(stubs.parse).not.toHaveBeenCalled();
  expect(stubs.insert).not.toHaveBeenCalled();
});

it("retains an unavailable checker result and the editable draft", async () => {
  vi.stubEnv("AI_IMPORT_PIPELINE_ENABLED", "true");
  stubs.check.mockImplementation(async (value: ParsedRidePost) => ({ parsed: value, status: "unavailable", trace: [] }));
  const result = await (await POST(request())).json();
  expect(result).toEqual({ importId, parsed: parsed(), check: { status: "unavailable", trace: [] } });
});

it("rejects malformed text before model work or persistence", async () => {
  vi.stubEnv("AI_IMPORT_PIPELINE_ENABLED", "true");
  expect((await POST(request({ text: "short" }))).status).toBe(400);
  expect(stubs.parse).not.toHaveBeenCalled();
  expect(stubs.check).not.toHaveBeenCalled();
  expect(stubs.insert).not.toHaveBeenCalled();
});
