import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResponseFunctionToolCall } from "openai/resources/responses/responses";
import { stubParseRidePost } from "./parse-ride-post";
import { checkRideDraft, type CheckerModelRunner } from "./check-ride-draft";
import { rideCheckMetadataSchema } from "./ride-check-contract";

vi.mock("server-only", () => ({}));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const cities = [{ id: 1, nameEn: "Skopje", nameMk: "Скопје" }, { id: 2, nameEn: "Veles", nameMk: "Велес" }];
function draft() {
  const parsed = stubParseRidePost("Offer a ride");
  parsed.classification = "offer";
  parsed.draft.origin.cityId = 1;
  parsed.draft.destination.cityId = 2;
  parsed.draft.distanceKm = null;
  return parsed;
}
function call(callId = "road-1", args: unknown = { originCityId: 1, destinationCityId: 2 }, name = "road_distance"): ResponseFunctionToolCall {
  return { type: "function_call", call_id: callId, name, arguments: JSON.stringify(args) };
}
const final = { output: [], output_parsed: { findings: [] } };

describe("checkRideDraft", () => {
  it("projects canonical names and structured fields without raw text, notes, or extra catalog fields", async () => {
    const parsed = draft();
    parsed.draft.notes = "private notes";
    parsed.draft.origin.rawText = "private original post";
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValue(final);
    await checkRideDraft(parsed, { cities: cities.map(city => ({ ...city, aliases: ["private alias"] })), tools: { road_distance: vi.fn() }, modelRunner: runner, now: new Date("2026-09-22T10:00:00Z") });
    const input = JSON.stringify(runner.mock.calls[0][0].input);
    expect(input).not.toContain("private");
    expect(input).toContain("Europe/Skopje");
    expect(input).toContain("2026-09-22T10:00:00.000Z");
    expect(input).toContain("Skopje");
  });
  it("executes the chosen route tool, returns matching output next round, and fills an editable estimate", async () => {
    const parsed = draft();
    const execute = vi.fn(async () => ({ distanceKm: 54.7 }));
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call()] }).mockResolvedValueOnce(final);
    const result = await checkRideDraft(parsed, { cities, tools: { road_distance: execute }, modelRunner: runner });
    expect(result.status).toBe("checked");
    expect(execute).toHaveBeenCalledWith({ originCityId: 1, destinationCityId: 2 });
    expect(runner.mock.calls[1][0].input).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "function_call", call_id: "road-1" }),
      { type: "function_call_output", call_id: "road-1", output: '{"distanceKm":54.7}' },
    ]));
    expect(result.parsed.draft.distanceKm).toBe(54.7);
    expect(result.parsed.draft.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ field: "distanceKm", code: "ambiguous", message: expect.stringMatching(/editable city-to-city/) })]));
    expect(parsed.draft.distanceKm).toBeNull();
  });

  it("treats an explicit service error as unavailable even when the object also contains a distance", async () => {
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call()] }).mockResolvedValueOnce(final);
    const result = await checkRideDraft(draft(), { cities, tools: { road_distance: async () => ({ distanceKm: 30, error: "Service failed" }) }, modelRunner: runner });
    expect(result.status).toBe("unavailable");
    expect(result.parsed.draft.distanceKm).toBeNull();
    expect(result.trace[0].result).toEqual({ error: "Service failed" });
  });

  it("returns error outputs for unknown, malformed, noncanonical, and unrelated calls without executing them", async () => {
    const malformed = { ...call("bad-json"), arguments: "not JSON private data" };
    const requests = [call("unknown", { secret: "private" }, "other"), malformed,
      call("fraction", { originCityId: 1.1, destinationCityId: 2 }),
      call("extra", { originCityId: 1, destinationCityId: 2, notes: "private" }),
      call("noncanonical", { originCityId: 99, destinationCityId: 2 }),
      call("reverse", { originCityId: 2, destinationCityId: 1 })];
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: requests }).mockResolvedValueOnce(final);
    const execute = vi.fn();
    const result = await checkRideDraft(draft(), { cities, tools: { road_distance: execute }, modelRunner: runner });
    expect(execute).not.toHaveBeenCalled();
    expect(result.status).toBe("unavailable");
    expect(result.trace).toHaveLength(6);
    expect(result.trace.every(entry => "error" in entry.result)).toBe(true);
    expect(JSON.stringify(result.trace)).not.toContain("private");
    expect(runner.mock.calls[1][0].input.filter(item => item.type === "function_call_output")).toHaveLength(6);
  });

  it("executes at most six calls in a multi-call round and finalizes with tools disabled", async () => {
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: Array.from({ length: 8 }, (_, i) => call(`call-${i}`)) }).mockResolvedValueOnce(final);
    const execute = vi.fn(async () => ({ distanceKm: 54.7 }));
    const result = await checkRideDraft(draft(), { cities, tools: { road_distance: execute }, modelRunner: runner });
    expect(execute).toHaveBeenCalledTimes(6);
    expect(runner.mock.calls[1][0].toolsEnabled).toBe(false);
    expect(result.trace.slice(6).every(entry => "error" in entry.result)).toBe(true);
    expect(result.status).toBe("checked");
  });

  it("allows only four tool-capable rounds then requests a final response", async () => {
    const runner = vi.fn<CheckerModelRunner>();
    for (let i = 0; i < 4; i++) runner.mockResolvedValueOnce({ output: [call(`round-${i}`)] });
    runner.mockResolvedValueOnce(final);
    const execute = vi.fn(async () => ({ distanceKm: 54.7 }));
    await checkRideDraft(draft(), { cities, tools: { road_distance: execute }, modelRunner: runner });
    expect(execute).toHaveBeenCalledTimes(4);
    expect(runner.mock.calls.map(([request]) => request.toolsEnabled)).toEqual([true, true, true, true, false]);
  });

  it("never executes a tool requested during finalization and rolls back pending fills", async () => {
    const runner = vi.fn<CheckerModelRunner>();
    for (let i = 0; i < 5; i++) runner.mockResolvedValueOnce({ output: [call(`round-${i}`)] });
    const execute = vi.fn(async () => ({ distanceKm: 54.7 }));
    const parsed = draft();
    const result = await checkRideDraft(parsed, { cities, tools: { road_distance: execute }, modelRunner: runner });
    expect(execute).toHaveBeenCalledTimes(4);
    expect(result.status).toBe("unavailable");
    expect(result.parsed.draft.distanceKm).toBeNull();
    expect(result.parsed.draft.warnings).toEqual([...parsed.draft.warnings, { field: null, code: "needs_review", message: "Automatic plausibility check was unavailable." }]);
  });

  it.each([0, -10, Infinity, NaN, "54.7", null])("does not accept invalid distance evidence %s", async distanceKm => {
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call()] }).mockResolvedValueOnce(final);
    const result = await checkRideDraft(draft(), { cities, tools: { road_distance: async () => ({ distanceKm }) }, modelRunner: runner });
    expect(result.status).toBe("unavailable");
    expect(result.parsed.draft.distanceKm).toBeNull();
    expect(result.trace[0].result).toEqual({ error: "Routing returned invalid evidence." });
  });

  it("preserves every existing draft field and warning while validating metadata as JSON", async () => {
    const parsed = draft();
    parsed.draft.distanceKm = 60;
    parsed.draft.confidence = 0.72;
    parsed.draft.pricePerSeatMkd = 400;
    parsed.draft.warnings.push({ field: "departureAt", code: "missing", message: "Review departure" });
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call()] }).mockResolvedValueOnce(final);
    const result = await checkRideDraft(parsed, { cities, tools: { road_distance: async () => ({ distanceKm: 54.7 }) }, modelRunner: runner });
    expect(result.parsed).toEqual(parsed);
    const metadata = rideCheckMetadataSchema.parse(JSON.parse(JSON.stringify(result)));
    expect(metadata).toEqual({ status: "checked", trace: result.trace });
  });

  it("rejects unsupported and unevidenced findings and uses code-written evidence for accepted distance findings", async () => {
    const findings = [
      { field: "pricePerSeatMkd", severity: "warn", message: "Invented price claim", evidenceCallIds: ["road-1"] },
      { field: null, severity: "warn", message: "Invented duplicate claim", evidenceCallIds: ["road-1"] },
      { field: "departureAt", severity: "warn", message: "Invented time claim", evidenceCallIds: ["road-1"] },
      { field: "distanceKm", severity: "warn", message: "No evidence", evidenceCallIds: [] },
      { field: "distanceKm", severity: "warn", message: "Unknown evidence", evidenceCallIds: ["missing"] },
      { field: "distanceKm", severity: "warn", message: "Mixed failed evidence", evidenceCallIds: ["road-1", "failed"] },
      { field: "distanceKm", severity: "warn", message: "Your car has too many passengers and price is wrong", evidenceCallIds: ["road-1"] },
      { field: "distanceKm", severity: "info", message: "City route", evidenceCallIds: ["road-1"] },
    ];
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call(), call("failed", {}, "unknown")] }).mockResolvedValueOnce({ output: [], output_parsed: { findings } });
    const parsed = draft();
    parsed.draft.distanceKm = 60;
    const result = await checkRideDraft(parsed, { cities, tools: { road_distance: async () => ({ distanceKm: 54.7 }) }, modelRunner: runner });
    const warnings = result.parsed.draft.warnings.slice(parsed.draft.warnings.length);
    expect(warnings).toEqual([
      { field: "distanceKm", code: "needs_review", message: "The checked city-to-city road distance is 54.7 km. Review the editable estimate for your actual route." },
      { field: "distanceKm", code: "ambiguous", message: "The checked city-to-city road distance is 54.7 km. Review the editable estimate for your actual route." },
    ]);
  });

  it.each([null, {}, { findings: [{ field: "not-a-field" }] }, { findings: [{ field: null, severity: "warn", message: "x".repeat(301), evidenceCallIds: ["road-1"] }] }])("fails open on unusable final output", async output_parsed => {
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call()] }).mockResolvedValueOnce({ output: [], output_parsed });
    const parsed = draft();
    const result = await checkRideDraft(parsed, { cities, tools: { road_distance: async () => ({ distanceKm: 54.7 }) }, modelRunner: runner });
    expect(result.status).toBe("unavailable");
    expect(result.parsed.draft.distanceKm).toBeNull();
    expect(result.parsed.draft.warnings).toHaveLength(parsed.draft.warnings.length + 1);
  });

  it("retains service failure evidence and does not expose thrown error details", async () => {
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call()] }).mockResolvedValueOnce(final);
    const result = await checkRideDraft(draft(), { cities, tools: { road_distance: async () => { throw new Error("secret credential"); } }, modelRunner: runner });
    expect(result.trace[0].result).toEqual({ error: "Road-distance service unavailable." });
    expect(JSON.stringify(result)).not.toContain("secret credential");
    expect(result.status).toBe("unavailable");
  });

  it("does not treat a successful model response without tool evidence as all-clear", async () => {
    const result = await checkRideDraft(draft(), { cities, tools: { road_distance: vi.fn() }, modelRunner: async () => final });
    expect(result.status).toBe("unavailable");
    expect(result.trace).toEqual([]);
  });

  it("fails open for missing credentials, model errors, and repeated unavailable checking", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const parsed = draft();
    const result = await checkRideDraft(parsed, { cities, tools: { road_distance: vi.fn() } });
    expect(result.status).toBe("unavailable");
    expect(result.parsed.draft.distanceKm).toBeNull();
    const repeated = await checkRideDraft(result.parsed, { cities, tools: { road_distance: vi.fn() }, modelRunner: async () => { throw new Error("request timed out"); } });
    expect(repeated.parsed.draft.warnings.filter(warning => warning.message === "Automatic plausibility check was unavailable.")).toHaveLength(1);
  });

  it("fails open for duplicate call IDs before executing the ambiguous call", async () => {
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call(), call()] });
    const execute = vi.fn(async () => ({ distanceKm: 54.7 }));
    const result = await checkRideDraft(draft(), { cities, tools: { road_distance: execute }, modelRunner: runner });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("unavailable");
    expect(result.parsed.draft.distanceKm).toBeNull();
  });

  it.each([
    [" checker-model ", " parser-model ", "checker-model"],
    [" ", " parser-model ", "parser-model"],
    ["", "", "gpt-5.4-mini"],
  ])("uses verified server model precedence and stateless SDK continuation", async (checkerModel, parserModel, expectedModel) => {
    vi.stubEnv("OPENAI_API_KEY", "fake-test-key");
    vi.stubEnv("OPENAI_CHECK_MODEL", checkerModel);
    vi.stubEnv("OPENAI_MODEL", parserModel);
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      const output = bodies.length === 1
        ? [{ type: "reasoning", id: "reasoning-1", summary: [], encrypted_content: "opaque-test-state" }, call()]
        : [{ type: "message", id: "message-1", role: "assistant", status: "completed", content: [{ type: "output_text", text: '{"findings":[]}', annotations: [] }] }];
      return new Response(JSON.stringify({ id: `response-${bodies.length}`, object: "response", status: "completed", model: expectedModel, output }), { headers: { "content-type": "application/json" } });
    }));
    const result = await checkRideDraft(draft(), { cities, tools: { road_distance: async () => ({ distanceKm: 54.7 }) } });
    expect(result.status).toBe("checked");
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toMatchObject({ model: expectedModel, store: false, tool_choice: "auto", include: ["reasoning.encrypted_content"] });
    expect(bodies[1].input).toEqual(expect.arrayContaining([
      { type: "reasoning", id: "reasoning-1", summary: [], encrypted_content: "opaque-test-state" },
      expect.objectContaining({ type: "function_call_output", call_id: "road-1" }),
    ]));
    expect(bodies[1]).not.toHaveProperty("previous_response_id");
  });

  it("does not retry provider failures", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fake-test-key");
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Unavailable" } }), { status: 503, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const result = await checkRideDraft(draft(), { cities, tools: { road_distance: vi.fn() } });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("unavailable");
  });
});
