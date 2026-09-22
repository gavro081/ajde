import { describe, expect, it } from "vitest";
import { calculateFairPrice } from "./fair-price-tool";

describe("calculateFairPrice", () => {
  it("shares the deterministic fuel cost across offered seats with explicit defaults", () => {
    expect(calculateFairPrice({ distanceKm: 100, availableSeats: 3, fuelType: null, consumptionL100Km: null }, { petrol: 80, diesel: 75 })).toEqual({
      pricePerSeatMkd: 187, totalTripCostMkd: 560,
      assumptions: { distanceKm: 100, availableSeats: 3, fuelType: "petrol", consumptionL100Km: 7, fuelPriceMkdL: 80, defaultFuelType: true, defaultConsumption: true, tollsMkd: 0 },
    });
  });
  it("does not substitute a configured petrol price for missing diesel configuration", () => {
    expect(calculateFairPrice({ distanceKm: 100, availableSeats: 3, fuelType: "diesel", consumptionL100Km: 5 }, { petrol: 80, diesel: null })).toEqual({ error: "Configured diesel fuel price is unavailable." });
  });
  it.each([0, -1, Infinity, NaN])("rejects invalid configured petrol price %s", petrol => {
    expect(calculateFairPrice({ distanceKm: 100, availableSeats: 3, fuelType: null, consumptionL100Km: null }, { petrol, diesel: 75 })).toHaveProperty("error");
  });
  it("returns unavailable evidence for zero-rounded or overflowing estimates", () => {
    expect(calculateFairPrice({ distanceKm: 0.00001, availableSeats: 3, fuelType: null, consumptionL100Km: null }, { petrol: 80, diesel: 75 })).toHaveProperty("error");
    expect(calculateFairPrice({ distanceKm: 1e300, availableSeats: 3, fuelType: null, consumptionL100Km: 1e300 }, { petrol: 80, diesel: 75 })).toHaveProperty("error");
  });
});
