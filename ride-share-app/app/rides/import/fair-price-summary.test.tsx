// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RideCheckSummary } from "./ride-check-summary";
import { calculateFairPrice } from "@/lib/ai/fair-price-tool";

afterEach(cleanup);
describe("fair-share review evidence", () => {
  it("shows calculated costs, fuel configuration, offered seats, and explicitly labelled defaults", () => {
    const args = { distanceKm: 100, availableSeats: 3, fuelType: null, consumptionL100Km: null };
    render(<RideCheckSummary cities={[]} check={{ status: "checked", trace: [{ callId: "price", tool: "fair_price", args, result: calculateFairPrice(args, { petrol: 80, diesel: null }) }] }} />);
    expect(screen.getByText(/Fair share: 187 MKD per seat/).textContent).toContain("560 MKD total trip cost");
    expect(screen.getByText(/3 available seats/).textContent).toContain("80 MKD/L");
    expect(screen.getByText(/petrol \(default/).textContent).toContain("7 L/100 km (default)");
    expect(screen.getByText(/Tolls are excluded/)).toBeTruthy();
  });
  it("labels missing fuel configuration as unavailable without showing a calculated cost", () => {
    render(<RideCheckSummary cities={[]} check={{ status: "unavailable", trace: [{ callId: "price", tool: "fair_price", args: null, result: { error: "Configured petrol fuel price is unavailable." } }] }} />);
    expect(screen.getByText(/Fair share unavailable: Configured petrol/)).toBeTruthy();
    expect(screen.queryByText(/MKD per seat/)).toBeNull();
  });
});
