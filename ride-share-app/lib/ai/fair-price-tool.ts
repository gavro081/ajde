import { calculateRideEstimate } from "../rides/ride-estimate";
import { fairPriceArgsSchema, fairPriceResultSchema, type FairPriceArgs, type FairPriceResult } from "./ride-check-contract";
import type { CheckTraceEntry } from "./ride-check-contract";
import type { ImportedRideDraft, RideDraftWarning } from "../rides/ride-draft";

/** The model selects this calculation; code owns every monetary value. */
export function calculateFairPrice(input: FairPriceArgs, prices: { petrol: number | null; diesel: number | null }): FairPriceResult | { error: string } {
  const validated = fairPriceArgsSchema.safeParse(input);
  if (!validated.success) return { error: "Invalid fair-price arguments." };
  const args = validated.data;
  const fuelType = args.fuelType ?? "petrol";
  const consumptionL100Km = args.consumptionL100Km ?? 7;
  const fuelPriceMkdL = prices[fuelType];
  if (fuelPriceMkdL === null || !Number.isFinite(fuelPriceMkdL) || fuelPriceMkdL <= 0) return { error: `Configured ${fuelType} fuel price is unavailable.` };
  const estimate = calculateRideEstimate({ distanceKm: args.distanceKm, consumptionL100Km, fuelPriceMkdL, seats: args.availableSeats, fuelType });
  const result = fairPriceResultSchema.safeParse({
    pricePerSeatMkd: estimate.pricePerSeatMkd, totalTripCostMkd: estimate.totalTripCostMkd,
    assumptions: { distanceKm: args.distanceKm, availableSeats: args.availableSeats, fuelType, consumptionL100Km, fuelPriceMkdL, defaultFuelType: args.fuelType === null, defaultConsumption: args.consumptionL100Km === null, tollsMkd: 0 },
  });
  return result.success ? result.data : { error: "Fair-price estimate is not usable." };
}

export function fairPriceMatchesDraft(args: FairPriceArgs, draft: ImportedRideDraft, trace: CheckTraceEntry[]) {
  const road = trace.find(entry => entry.tool === "road_distance" && "distanceKm" in entry.result);
  const distanceKm = draft.distanceKm ?? (road && "distanceKm" in road.result ? road.result.distanceKm : null);
  const fuelType = draft.car?.fuelType === "petrol" || draft.car?.fuelType === "diesel" ? draft.car.fuelType : null;
  return args.distanceKm === distanceKm && args.availableSeats === draft.seatsTotal && args.fuelType === fuelType && args.consumptionL100Km === (draft.car?.consumptionL100Km ?? null);
}

/** Recompute from the validated basis; positive but inconsistent numbers are not evidence. */
export function validateFairPriceResult(value: unknown, args: FairPriceArgs): FairPriceResult | { error: string } {
  const parsed = fairPriceResultSchema.safeParse(value);
  if (!parsed.success) return { error: "Fair-price service returned invalid evidence." };
  const result = parsed.data;
  const expected = calculateFairPrice(args, { petrol: result.assumptions.fuelPriceMkdL, diesel: result.assumptions.fuelPriceMkdL });
  if ("error" in expected || result.pricePerSeatMkd !== expected.pricePerSeatMkd || result.totalTripCostMkd !== expected.totalTripCostMkd ||
    Object.entries(expected.assumptions).some(([key, value]) => result.assumptions[key as keyof typeof result.assumptions] !== value)) {
    return { error: "Fair-price evidence does not match the requested calculation." };
  }
  return result;
}

export function fairPriceWarning(price: number | null, result: FairPriceResult): RideDraftWarning | null {
  if (price === null || !Number.isFinite(price) || result.pricePerSeatMkd <= 0) return null;
  const ratio = price / result.pricePerSeatMkd;
  if (ratio >= 0.3 && ratio <= 2.5) return null;
  const a = result.assumptions;
  return { field: "pricePerSeatMkd", code: "needs_review", message: `Per-seat price ${price} MKD is ${ratio > 2.5 ? "high" : "low"} versus calculated ${result.pricePerSeatMkd} MKD. Basis: ${a.distanceKm} km, ${a.availableSeats} available seats, ${a.fuelType}${a.defaultFuelType ? " (default)" : ""}, ${a.consumptionL100Km} L/100 km${a.defaultConsumption ? " (default)" : ""}, ${a.fuelPriceMkdL} MKD/L; tolls excluded. Review your price.`.slice(0, 300) };
}
