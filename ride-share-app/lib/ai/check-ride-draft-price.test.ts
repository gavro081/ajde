import { describe, expect, it, vi } from "vitest";
import type { ResponseFunctionToolCall } from "openai/resources/responses/responses";
import { checkRideDraft, type CheckerModelRunner } from "./check-ride-draft";
import { stubParseRidePost } from "./parse-ride-post";
import { calculateFairPrice } from "./fair-price-tool";
import { rideCheckMetadataSchema, type FairPriceArgs } from "./ride-check-contract";

vi.mock("server-only", () => ({}));
const cities = [{ id: 1, nameEn: "Skopje", nameMk: "Скопје" }, { id: 2, nameEn: "Veles", nameMk: "Велес" }];
const args: FairPriceArgs = { distanceKm: 100, availableSeats: 3, fuelType: null, consumptionL100Km: null };
function draft(price: number | null = 1000, distance: number | null = null) {
  const parsed = stubParseRidePost("Offer a ride");
  parsed.classification = "offer";
  Object.assign(parsed.draft, { pricePerSeatMkd: price, distanceKm: distance, seatsTotal: 3, car: null });
  parsed.draft.origin.cityId = 1;
  parsed.draft.destination.cityId = 2;
  return parsed;
}
function call(name: string, args: unknown, id = name): ResponseFunctionToolCall {
  return { type: "function_call", name, arguments: JSON.stringify(args), call_id: id };
}
const final = { output: [], output_parsed: { findings: [] } };
const priceTool = (input: FairPriceArgs) => Promise.resolve(calculateFairPrice(input, { petrol: 80, diesel: 75 }));

describe("fair-price ride checks", () => {
  it("lets the model request routing then actual available-seat arithmetic and warns without changing the price", async () => {
    const runner = vi.fn<CheckerModelRunner>()
      .mockResolvedValueOnce({ output: [call("road_distance", { originCityId: 1, destinationCityId: 2 })] })
      .mockResolvedValueOnce({ output: [call("fair_price", args)] }).mockResolvedValueOnce(final);
    const result = await checkRideDraft(draft(), { cities, modelRunner: runner, tools: { road_distance: async () => ({ distanceKm: 100 }), fair_price: priceTool } });
    expect(result.status).toBe("checked");
    expect(result.parsed.draft.pricePerSeatMkd).toBe(1000);
    expect(result.parsed.draft.distanceKm).toBe(100);
    const warning = result.parsed.draft.warnings.find(item => item.field === "pricePerSeatMkd");
    expect(warning).toMatchObject({ code: "needs_review", message: expect.stringMatching(/1000 MKD.*187 MKD/) });
    expect(warning?.message).toContain("3 available seats");
    expect(warning?.message).toContain("default");
    expect(warning!.message.length).toBeLessThanOrEqual(300);
    expect(runner.mock.calls[2][0].input).toEqual(expect.arrayContaining([expect.objectContaining({ type: "function_call_output", call_id: "fair_price", output: expect.stringContaining('"pricePerSeatMkd":187') })]));
    expect(rideCheckMetadataSchema.parse(JSON.parse(JSON.stringify(result))).trace).toEqual(result.trace);
  });

  it.each([[42, false], [350, false], [41, true], [351, true], [0, true], [null, false]] as const)("applies strict 0.3/2.5 boundaries to price %s", async (price, warns) => {
    const parsed = draft(price, 100);
    parsed.draft.seatsTotal = 4; // 560 / 4 = 140 MKD; exact boundaries are 42 and 350.
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call("fair_price", { ...args, availableSeats: 4 })] })
      .mockResolvedValueOnce({ output: [], output_parsed: { findings: [
        { field: "pricePerSeatMkd", severity: "warn", message: "Unsupported model price", evidenceCallIds: ["fair_price"] },
        { field: null, severity: "warn", message: "Price is wrong", evidenceCallIds: ["fair_price"] },
        { field: "distanceKm", severity: "warn", message: "Price is wrong", evidenceCallIds: ["fair_price"] },
      ] } });
    const result = await checkRideDraft(parsed, { cities, modelRunner: runner, tools: { road_distance: vi.fn(), fair_price: priceTool } });
    expect(result.parsed.draft.warnings.filter(item => item.field === "pricePerSeatMkd")).toHaveLength(warns ? 1 : 0);
    expect(JSON.stringify(result.parsed)).not.toContain("Unsupported model price");
    expect(JSON.stringify(result.parsed)).not.toContain("Price is wrong");
    expect(result.parsed.draft.pricePerSeatMkd).toBe(price);
  });

  it.each([
    { ...args, distanceKm: 101 }, { ...args, availableSeats: 4 }, { ...args, fuelType: "diesel" },
    { ...args, consumptionL100Km: 7 }, { ...args, distanceKm: 0 }, { ...args, availableSeats: 1.5 },
    { ...args, availableSeats: 9 }, { ...args, fuelType: "electric" }, { ...args, consumptionL100Km: 0 },
    { ...args, distanceKm: "100" },
  ])("does not execute unrelated or invalid calculation bases", async requested => {
    const execute = vi.fn(priceTool);
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call("fair_price", requested)] }).mockResolvedValueOnce(final);
    const result = await checkRideDraft(draft(1000, 100), { cities, modelRunner: runner, tools: { road_distance: vi.fn(), fair_price: execute } });
    expect(execute).not.toHaveBeenCalled();
    expect(result.trace[0].result).toHaveProperty("error");
    expect(result.parsed.draft.warnings.some(item => item.field === "pricePerSeatMkd")).toBe(false);
  });

  it("requires known offered seats and distance before executing a fair-price request", async () => {
    const execute = vi.fn(priceTool);
    const parsed = draft();
    parsed.draft.seatsTotal = null;
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call("fair_price", args)] }).mockResolvedValueOnce(final);
    const result = await checkRideDraft(parsed, { cities, modelRunner: runner, tools: { road_distance: vi.fn(), fair_price: execute } });
    expect(execute).not.toHaveBeenCalled();
    expect(result.status).toBe("unavailable");
  });

  it("uses existing distance instead of a conflicting routing estimate", async () => {
    const execute = vi.fn(priceTool);
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call("road_distance", { originCityId: 1, destinationCityId: 2 })] })
      .mockResolvedValueOnce({ output: [call("fair_price", { ...args, distanceKm: 110 })] }).mockResolvedValueOnce(final);
    const result = await checkRideDraft(draft(1000, 100), { cities, modelRunner: runner, tools: { road_distance: async () => ({ distanceKm: 110 }), fair_price: execute } });
    expect(execute).not.toHaveBeenCalled();
    expect(result.parsed.draft.distanceKm).toBe(100);
  });

  it("uses specified diesel consumption and offered seats, not car capacity", async () => {
    const parsed = draft(1000, 100);
    parsed.draft.car = { carModelId: null, make: null, model: null, fuelType: "diesel", consumptionL100Km: 5, color: null, plateLast3: null, seatsTotal: 8 };
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call("fair_price", { ...args, fuelType: "diesel", consumptionL100Km: 5 })] }).mockResolvedValueOnce(final);
    const result = await checkRideDraft(parsed, { cities, modelRunner: runner, tools: { road_distance: vi.fn(), fair_price: priceTool } });
    expect(result.trace[0].result).toMatchObject({ pricePerSeatMkd: 125, totalTripCostMkd: 375, assumptions: { availableSeats: 3, fuelType: "diesel", consumptionL100Km: 5, defaultFuelType: false, defaultConsumption: false } });
  });

  it("labels unsupported fuel as a petrol approximation", async () => {
    const parsed = draft(1000, 100);
    parsed.draft.car = { carModelId: null, make: null, model: null, fuelType: "electric", consumptionL100Km: null, color: null, plateLast3: null, seatsTotal: 8 };
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call("fair_price", args)] }).mockResolvedValueOnce(final);
    const result = await checkRideDraft(parsed, { cities, modelRunner: runner, tools: { road_distance: vi.fn(), fair_price: priceTool } });
    expect(result.trace[0].result).toMatchObject({ assumptions: { fuelType: "petrol", defaultFuelType: true } });
  });

  it.each(["zero", "total", "price", "basis", "defaults", "error", "error-empty", "error-null", "error-code", "error-long"])("rejects %s or contradictory estimate evidence", async corruption => {
    const value = calculateFairPrice(args, { petrol: 80, diesel: 75 });
    if ("error" in value) throw new Error(value.error);
    const bad = structuredClone(value);
    if (corruption === "zero") bad.pricePerSeatMkd = 0;
    if (corruption === "total") bad.totalTripCostMkd = 561;
    if (corruption === "price") bad.pricePerSeatMkd = 188;
    if (corruption === "basis") bad.assumptions.availableSeats = 4;
    if (corruption === "defaults") bad.assumptions.defaultFuelType = false;
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call("fair_price", args)] }).mockResolvedValueOnce(final);
    const error = corruption === "error-empty" ? "" : corruption === "error-null" ? null : corruption === "error-code" ? 503 : corruption === "error-long" ? "x".repeat(301) : "Unavailable";
    const result = await checkRideDraft(draft(1000, 100), { cities, modelRunner: runner, tools: { road_distance: vi.fn(), fair_price: async () => corruption.startsWith("error") ? { ...bad, error } : bad } });
    expect(result.status).toBe("unavailable");
    expect(result.trace[0].result).toHaveProperty("error");
    expect(result.parsed.draft.warnings.some(item => item.field === "pricePerSeatMkd")).toBe(false);
  });

  it("shares the six-call execution budget with road routing", async () => {
    const execute = vi.fn(priceTool);
    const runner = vi.fn<CheckerModelRunner>()
      .mockResolvedValueOnce({ output: Array.from({ length: 5 }, (_, i) => call("road_distance", { originCityId: 1, destinationCityId: 2 }, `road-${i}`)) })
      .mockResolvedValueOnce({ output: [call("fair_price", args, "price-1"), call("fair_price", args, "price-2")] }).mockResolvedValueOnce(final);
    const result = await checkRideDraft(draft(), { cities, modelRunner: runner, tools: { road_distance: async () => ({ distanceKm: 100 }), fair_price: execute } });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.trace[6].result).toEqual({ error: "Tool execution budget exhausted." });
    expect(runner.mock.calls[2][0].toolsEnabled).toBe(false);
  });

  it("reports unavailable evidence when the optional executor is absent", async () => {
    const runner = vi.fn<CheckerModelRunner>().mockResolvedValueOnce({ output: [call("fair_price", args)] }).mockResolvedValueOnce(final);
    const result = await checkRideDraft(draft(1000, 100), { cities, modelRunner: runner, tools: { road_distance: vi.fn() } });
    expect(result.trace[0].result).toEqual({ error: "Fair-price service unavailable." });
  });
});
