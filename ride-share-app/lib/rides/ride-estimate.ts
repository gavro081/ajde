export type CombustionFuelType = "petrol" | "diesel";

export type RideEstimateInput = {
  distanceKm: number;
  consumptionL100Km: number;
  fuelPriceMkdL: number;
  seats: number;
  fuelType: CombustionFuelType;
};

const CO2_KG_PER_LITRE: Record<CombustionFuelType, number> = {
  petrol: 2.31,
  diesel: 2.68,
};

function positiveFinite(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
}

export function calculateRideEstimate(input: RideEstimateInput) {
  positiveFinite(input.distanceKm, "Distance");
  positiveFinite(input.consumptionL100Km, "Consumption");
  positiveFinite(input.fuelPriceMkdL, "Fuel price");
  positiveFinite(input.seats, "Seats");
  if (!Number.isInteger(input.seats)) throw new RangeError("Seats must be a whole number");

  const fuelLitres = (input.distanceKm * input.consumptionL100Km) / 100;
  const totalFuelCostMkd = fuelLitres * input.fuelPriceMkdL;
  const rawPricePerSeatMkd = totalFuelCostMkd / input.seats;
  const tripCo2Kg = fuelLitres * CO2_KG_PER_LITRE[input.fuelType];

  return {
    fuelLitres,
    totalFuelCostMkd,
    pricePerSeatMkd: Math.round(rawPricePerSeatMkd),
    tripCo2Kg,
    potentialCo2SavedKg: tripCo2Kg * input.seats,
  };
}

export function resolvePricePerSeat(
  userPriceMkd: number | null,
  suggestedPriceMkd: number,
) {
  if (userPriceMkd !== null) {
    if (!Number.isFinite(userPriceMkd) || userPriceMkd < 0) {
      throw new RangeError("User price must be a nonnegative finite number");
    }
    return userPriceMkd;
  }
  return suggestedPriceMkd;
}
