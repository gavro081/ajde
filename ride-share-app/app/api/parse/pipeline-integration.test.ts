import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const service = vi.hoisted(() => ({ model: vi.fn(), insert: vi.fn(), rpc: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { parse: service.model }; } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "driver" } } }) },
  rpc: service.rpc,
  from: (table: string) => table === "imports" ? { insert: service.insert } : {
    select: async () => ({ data: table === "cities" ? [
      { id: 1, name_en: "Skopje", name_mk: "Скопје", aliases: [], lat: 41.99646, lng: 21.43141 },
      { id: 2, name_en: "Veles", name_mk: "Велес", aliases: [], lat: 41.71556, lng: 21.77556 },
    ] : [], error: null }),
  },
}) }));
import { emptyOfferDraft } from "@/lib/rides/offer-interpretation";
import { parsedRidePostSchema } from "@/lib/ai/parsed-ride-post";
import { POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-a-credential");
  vi.stubEnv("AI_IMPORT_PIPELINE_ENABLED", "true");
  service.rpc.mockResolvedValue({ data: true, error: null });
  service.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "10000000-0000-4000-8000-000000000001" }, error: null }) }) });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("carries a real parser result through guards, model-selected routing, persistence, and editable draft validation", async () => {
  service.model.mockResolvedValueOnce({ output_parsed: {
    classification: "offer", sourceLanguage: "mk", draft: { ...emptyOfferDraft(), source: "imported",
      origin: { cityId: 1, pickupPointId: null, rawText: "Skopje" },
      destination: { cityId: 2, pickupPointId: null, rawText: "Veles" },
      departureAt: "2026-09-23T15:00:00Z", seatsTotal: 3, pricePerSeatMkd: 200, confidence: 0.8,
      notes: "private notes for the driver", warnings: [{ field: "departureAt", code: "needs_review", message: "Confirm departure." }],
    },
  } }).mockResolvedValueOnce({ output: [{ type: "function_call", call_id: "route-1", name: "road_distance", arguments: '{"originCityId":1,"destinationCityId":2}' }] })
    .mockResolvedValueOnce({ output: [], output_parsed: { findings: [] } });
  const transport = vi.fn<typeof fetch>(async () => Response.json({ code: "Ok", routes: [{ distance: 52100 }] }));
  vi.stubGlobal("fetch", transport);
  const response = await POST(new Request("http://localhost/api/parse", { method: "POST", body: JSON.stringify({ text: "I offer Skopje to Veles tomorrow at 17:00, 3 seats.", sourceHint: "other" }) }));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.check).toMatchObject({ status: "checked", trace: [{ callId: "route-1", result: { distanceKm: 52.1 } }] });
  expect(body.parsed.draft).toMatchObject({ distanceKm: 52.1, pricePerSeatMkd: 200, confidence: 0.8 });
  expect(body.parsed.draft.warnings).toContainEqual({ field: "departureAt", code: "needs_review", message: "Confirm departure." });
  expect(service.rpc).toHaveBeenCalledWith("try_ride_routing_request");
  expect(transport.mock.calls[0][0]).toContain("21.43141,41.99646;21.77556,41.71556");
  const checkerInput = JSON.stringify(service.model.mock.calls[1][0].input);
  expect(checkerInput).not.toContain("private notes");
  expect(checkerInput).not.toContain("I offer");
  expect(service.model.mock.calls[2][0].input).toEqual(expect.arrayContaining([{ type: "function_call_output", call_id: "route-1", output: '{"distanceKm":52.1}' }]));
  const stored = service.insert.mock.calls[0][0].parsed_json;
  expect(stored.check).toEqual(body.check);
  expect(parsedRidePostSchema.parse(stored)).toEqual(body.parsed);
});
