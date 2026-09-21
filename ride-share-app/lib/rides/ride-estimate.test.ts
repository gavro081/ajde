import { describe, expect, it } from "vitest";

import { calculateRideEstimate, resolvePricePerSeat } from "./ride-estimate";

describe("calculateRideEstimate", () => {
  it("calculates a petrol trip and rounds the suggested seat price", () => {
    const result = calculateRideEstimate({
      distanceKm: 100,
      consumptionL100Km: 7,
      fuelPriceMkdL: 80,
      seats: 3,
      fuelType: "petrol",
    });

    expect(result.fuelLitres).toBe(7);
    expect(result.totalFuelCostMkd).toBe(560);
    expect(result.pricePerSeatMkd).toBe(187);
    expect(result.tripCo2Kg).toBeCloseTo(16.17);
    expect(result.potentialCo2SavedKg).toBeCloseTo(48.51);
  });

  it("adds tolls to the shared trip cost without changing fuel or CO2", () => {
    const result = calculateRideEstimate({
      distanceKm: 100,
      consumptionL100Km: 7,
      fuelPriceMkdL: 80,
      seats: 3,
      fuelType: "petrol",
      tollsMkd: 100,
    });

    expect(result.totalFuelCostMkd).toBe(560);
    expect(result.totalTripCostMkd).toBe(660);
    expect(result.pricePerSeatMkd).toBe(220);
    expect(result.tripCo2Kg).toBeCloseTo(16.17);
    expect(() => calculateRideEstimate({ distanceKm: 100, consumptionL100Km: 7, fuelPriceMkdL: 80, seats: 3, fuelType: "petrol", tollsMkd: -5 })).toThrow(RangeError);
  });

  it("uses the diesel emissions factor", () => {
    const result = calculateRideEstimate({
      distanceKm: 200,
      consumptionL100Km: 5,
      fuelPriceMkdL: 75,
      seats: 2,
      fuelType: "diesel",
    });

    expect(result.tripCo2Kg).toBeCloseTo(26.8);
    expect(result.pricePerSeatMkd).toBe(375);
  });

  it.each([
    { distanceKm: 0, consumptionL100Km: 7, fuelPriceMkdL: 80, seats: 3 },
    { distanceKm: 100, consumptionL100Km: -1, fuelPriceMkdL: 80, seats: 3 },
    { distanceKm: 100, consumptionL100Km: 7, fuelPriceMkdL: 0, seats: 3 },
    { distanceKm: 100, consumptionL100Km: 7, fuelPriceMkdL: 80, seats: 0 },
  ])("rejects invalid or zero calculator inputs", (values) => {
    expect(() =>
      calculateRideEstimate({ ...values, fuelType: "petrol" }),
    ).toThrow(RangeError);
  });
});

describe("resolvePricePerSeat", () => {
  it("preserves a user override instead of replacing it with the suggestion", () => {
    expect(resolvePricePerSeat(450, 375)).toBe(450);
    expect(resolvePricePerSeat(null, 375)).toBe(375);
  });
});
