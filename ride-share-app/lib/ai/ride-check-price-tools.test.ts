import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRideCheckTools } from "./ride-check-tools";
import type { Database } from "../supabase/database.types";

vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllEnvs());
describe("production fair-price executor", () => {
  it("uses configured fuel prices and reports missing configuration without accessing the database", async () => {
    const supabase = createClient<Database>("https://example.test", "test-key", { auth: { persistSession: false, autoRefreshToken: false } });
    const tools = createRideCheckTools(supabase);
    const input = { distanceKm: 100, availableSeats: 3, fuelType: null, consumptionL100Km: null };
    vi.stubEnv("FUEL_PRICE_PETROL_MKD_L", "80");
    expect(await tools.fair_price!(input)).toMatchObject({ pricePerSeatMkd: 187, totalTripCostMkd: 560, assumptions: { fuelPriceMkdL: 80 } });
    vi.stubEnv("FUEL_PRICE_PETROL_MKD_L", "");
    expect(await tools.fair_price!(input)).toEqual({ error: "Configured petrol fuel price is unavailable." });
  });
});
