import { expect, it, vi } from "vitest";
import type { ResponseFunctionToolCall } from "openai/resources/responses/responses";
import { checkRideDraft, type CheckerModelRunner } from "./check-ride-draft";
import { stubParseRidePost } from "./parse-ride-post";
import { rideCheckMetadataSchema } from "./ride-check-contract";

vi.mock("server-only", () => ({}));
const cities = [{ id: 1, nameEn: "Skopje", nameMk: "Скопје" }, { id: 2, nameEn: "Veles", nameMk: "Велес" }];
const args = { originCityId: 1, destinationCityId: 2, departureAt: "2026-09-22T14:00:00Z" };
const ride = { id: "20000000-0000-4000-8000-000000000001", departureAt: args.departureAt, pricePerSeatMkd: 150, seatsAvailable: 2 };
function draft() {
  const parsed = stubParseRidePost("Offer a ride");
  parsed.classification = "offer";
  parsed.draft.origin.cityId = 1;
  parsed.draft.destination.cityId = 2;
  parsed.draft.departureAt = args.departureAt;
  return parsed;
}
function call(value: unknown = args, callId = "similar-1"): ResponseFunctionToolCall {
  return { type: "function_call", call_id: callId, name: "find_similar_rides", arguments: JSON.stringify(value) };
}
const finding = { field: null, severity: "warn", message: "This is definitely a duplicate", evidenceCallIds: ["similar-1"] };
function runner(findings: unknown[] = [finding], value: unknown = args) {
  return vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call(value)] }).mockResolvedValueOnce({ output: [], output_parsed: { findings } });
}

it("passes successful similar-ride evidence back to the model and writes a conservative warning", async () => {
  const modelRunner = runner();
  const parsed = draft();
  const result = await checkRideDraft(parsed, { cities, modelRunner, tools: { road_distance: vi.fn(), find_similar_rides: async () => ({ rides: [ride] }) } });
  expect(result.status).toBe("checked");
  expect(result.trace[0].result).toEqual({ rides: [ride] });
  expect(modelRunner.mock.calls[1][0].input).toContainEqual({ type: "function_call_output", call_id: "similar-1", output: JSON.stringify({ rides: [ride] }) });
  expect(result.parsed.draft.warnings.at(-1)).toEqual({ field: null, code: "needs_review", message: "Found 1 ride offer on the same route within three hours. These are possible duplicates; review the matches before publishing." });
  expect({ ...result.parsed.draft, warnings: parsed.draft.warnings }).toEqual(parsed.draft);
});

it("retains successful empty search evidence without a duplicate warning", async () => {
  const parsed = draft();
  const result = await checkRideDraft(parsed, { cities, modelRunner: runner(), tools: { road_distance: vi.fn(), find_similar_rides: async () => ({ rides: [] }) } });
  expect(result.status).toBe("checked");
  expect(result.parsed).toEqual(parsed);
  expect(rideCheckMetadataSchema.parse(result)).toEqual({ status: "checked", trace: result.trace });
});

it.each([
  { originCityId: 2, destinationCityId: 1 }, { destinationCityId: 99 }, { departureAt: "2026-09-22T15:00:00Z" },
  { departureAt: "tomorrow" }, { departureAt: "2026-09-22T14:00:00" }, { originCityId: 1.1 },
])("does not execute unrelated or invalid model arguments: %j", async change => {
  const execute = vi.fn(async () => ({ rides: [ride] }));
  const result = await checkRideDraft(draft(), { cities, modelRunner: runner([finding], { ...args, ...change }), tools: { road_distance: vi.fn(), find_similar_rides: execute } });
  expect(execute).not.toHaveBeenCalled();
  expect(result.status).toBe("unavailable");
});

it("compares departure instants across equivalent timezone offsets", async () => {
  const execute = vi.fn(async () => ({ rides: [ride] }));
  const result = await checkRideDraft(draft(), { cities, modelRunner: runner([], { ...args, departureAt: "2026-09-22T16:00:00+02:00" }), tools: { road_distance: vi.fn(), find_similar_rides: execute } });
  expect(execute).toHaveBeenCalledOnce();
  expect(result.status).toBe("checked");
});

it("does not invent a missing departure or execute a search for it", async () => {
  const parsed = draft(); parsed.draft.departureAt = null;
  const execute = vi.fn();
  const result = await checkRideDraft(parsed, { cities, modelRunner: runner(), tools: { road_distance: vi.fn(), find_similar_rides: execute } });
  expect(execute).not.toHaveBeenCalled();
  expect(result.parsed.draft.departureAt).toBeNull();
});

it.each([
  { rides: [{ ...ride, departureAt: "2026-09-22T10:59:59Z" }] }, { rides: [{ ...ride, departureAt: "2026-09-22T17:00:01Z" }] },
  { rides: [{ ...ride, seatsAvailable: 9 }] }, { rides: [{ ...ride, id: "fake" }] }, { rides: Array.from({ length: 6 }, () => ride) },
  { rides: [ride], error: "Query failed" }, { rides: [ride], error: "" }, { rides: [ride], error: null }, { rides: [ride], error: "x".repeat(301) }, { nope: [] },
])("rejects invalid or explicitly failed search evidence: %j", async value => {
  const parsed = draft();
  const result = await checkRideDraft(parsed, { cities, modelRunner: runner(), tools: { road_distance: vi.fn(), find_similar_rides: async () => value } });
  expect(result.status).toBe("unavailable");
  expect(result.trace[0].result).toHaveProperty("error");
  expect(result.parsed.draft.warnings).toHaveLength(parsed.draft.warnings.length + 1);
});

it.each(["2026-09-22T11:00:00Z", "2026-09-22T17:00:00Z"])("accepts inclusive result boundary %s", async departureAt => {
  const result = await checkRideDraft(draft(), { cities, modelRunner: runner(), tools: { road_distance: vi.fn(), find_similar_rides: async () => ({ rides: [{ ...ride, departureAt }] }) } });
  expect(result.status).toBe("checked");
});

it("treats missing and throwing executors as unavailable evidence", async () => {
  for (const execute of [undefined, async () => { throw new Error("secret"); }]) {
    const result = await checkRideDraft(draft(), { cities, modelRunner: runner(), tools: { road_distance: vi.fn(), find_similar_rides: execute } });
    expect(result.trace[0].result).toEqual({ error: "Similar-ride search unavailable." });
  }
});

it("rejects missing, unknown, and failed evidence citations", async () => {
  const parsed = draft();
  const modelRunner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call(), { ...call({}, "failed"), name: "unknown" }] }).mockResolvedValueOnce({ output: [], output_parsed: { findings: [
    { ...finding, evidenceCallIds: [] }, { ...finding, evidenceCallIds: ["unknown"] }, { ...finding, evidenceCallIds: ["similar-1", "failed"] },
  ] } });
  const result = await checkRideDraft(parsed, { cities, modelRunner, tools: { road_distance: vi.fn(), find_similar_rides: async () => ({ rides: [ride] }) } });
  expect(result.parsed).toEqual(parsed);
});

it("shares the six-execution budget with road routing", async () => {
  const execute = vi.fn(async () => ({ rides: [] }));
  const road = vi.fn(async () => ({ distanceKm: 50 }));
  const modelRunner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [
    { ...call({ originCityId: 1, destinationCityId: 2 }, "road-1"), name: "road_distance" },
    ...Array.from({ length: 7 }, (_, index) => call(args, `similar-${index}`)),
  ] }).mockResolvedValueOnce({ output: [], output_parsed: { findings: [] } });
  const result = await checkRideDraft(draft(), { cities, modelRunner, tools: { road_distance: road, find_similar_rides: execute } });
  expect(road).toHaveBeenCalledOnce();
  expect(execute).toHaveBeenCalledTimes(5);
  expect(modelRunner.mock.calls[1][0].toolsEnabled).toBe(false);
  expect(result.trace.slice(6).every(entry => "error" in entry.result)).toBe(true);
});
