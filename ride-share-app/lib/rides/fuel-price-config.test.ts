import { afterEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fuelPriceConfig } from "./fuel-price-config";

afterEach(() => { vi.unstubAllEnvs(); });

it("reads positive pump prices from the environment", () => {
  vi.stubEnv("FUEL_PRICE_PETROL_MKD_L", "86.5");
  vi.stubEnv("FUEL_PRICE_DIESEL_MKD_L", " 79 ");
  expect(fuelPriceConfig()).toEqual({ petrol: 86.5, diesel: 79 });
});

it.each(["", "   ", "0", "-80", "eighty", "Infinity"])("treats the price %j as not configured", (value) => {
  vi.stubEnv("FUEL_PRICE_PETROL_MKD_L", value);
  vi.stubEnv("FUEL_PRICE_DIESEL_MKD_L", value);
  expect(fuelPriceConfig()).toEqual({ petrol: null, diesel: null });
});
