// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { emptyOfferDraft } from "@/lib/rides/offer-interpretation";
import { ImportRideForm } from "./import-ride-form";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const cities = [{ id: 1, name_en: "Skopje" }, { id: 2, name_en: "Veles" }];
const payload = (check: unknown) => ({ importId: "10000000-0000-4000-8000-000000000001", parsed: {
  classification: "offer", sourceLanguage: "mk", draft: { ...emptyOfferDraft(), source: "imported", distanceKm: 52,
    origin: { cityId: 1, pickupPointId: null, rawText: "Skopje" }, destination: { cityId: 2, pickupPointId: null, rawText: "Veles" },
  },
}, check });
const road = { callId: "road-1", tool: "road_distance", args: { originCityId: 1, destinationCityId: 2 }, result: { distanceKm: 52 } };
async function submit(check: unknown, enabled: boolean) {
  const transport = vi.fn<typeof fetch>(async () => Response.json(payload(check)));
  vi.stubGlobal("fetch", transport);
  render(<ImportRideForm cities={cities} pipelineEnabled={enabled} />);
  fireEvent.change(screen.getByLabelText(/Post text/), { target: { value: "Skopje Veles tomorrow at 17h" } });
  fireEvent.click(screen.getByRole("button", { name: "Create review draft" }));
  await screen.findByText("Review the extracted details");
  return transport;
}

it("shows road evidence, its editable scope, and explicit form continuation", async () => {
  const transport = await submit({ status: "checked", trace: [road] }, true);
  expect(screen.getByText("How we checked this")).toBeTruthy();
  expect(screen.getByText(/Road distance.*Skopje.*Veles.*52 km/)).toBeTruthy();
  expect(screen.getByText(/editable city-to-city estimate/i)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Continue to editable ride form" }).getAttribute("href")).toBe("/rides/new?import=10000000-0000-4000-8000-000000000001");
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][0]).toBe("/api/parse");
});

it("hides check UI while disabled even if a response includes earlier metadata", async () => {
  await submit({ status: "checked", trace: [road] }, false);
  expect(screen.queryByText("How we checked this")).toBeNull();
  expect(screen.getByRole("link", { name: "Continue to editable ride form" })).toBeTruthy();
});

it("shows unavailable checks without suggesting the draft passed", async () => {
  await submit({ status: "unavailable", trace: [{ ...road, result: { error: "Routing is unavailable." } }] }, true);
  expect(screen.getByText(/Automatic plausibility check was unavailable/)).toBeTruthy();
  expect(screen.getByText(/Road distance.*unavailable/i)).toBeTruthy();
  expect(screen.queryByText(/52 km/)).toBeNull();
});

it("does not present an empty trace as a successful check", async () => {
  await submit({ status: "checked", trace: [] }, true);
  expect(screen.getByText(/No tool evidence was returned/)).toBeTruthy();
});

it("clears the previous review when text or import mode changes", async () => {
  await submit({ status: "checked", trace: [road] }, true);
  fireEvent.change(screen.getByLabelText(/Post text/), { target: { value: "Updated Skopje to Veles post for tomorrow" } });
  expect(screen.queryByRole("link", { name: "Continue to editable ride form" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Create review draft" }));
  await screen.findByRole("link", { name: "Continue to editable ride form" });
  fireEvent.click(screen.getByRole("button", { name: "Facebook screenshot" }));
  expect(screen.queryByRole("link", { name: "Continue to editable ride form" })).toBeNull();
});

it("retains all three tool summaries through the import response boundary", async () => {
  await submit({ status: "checked", trace: [road, {
    callId: "fair-1", tool: "fair_price", args: { distanceKm: 60, availableSeats: 3, fuelType: null, consumptionL100Km: null },
    result: { pricePerSeatMkd: 140, totalTripCostMkd: 420, assumptions: { distanceKm: 60, availableSeats: 3, fuelType: "petrol", consumptionL100Km: 7, fuelPriceMkdL: 100, defaultFuelType: true, defaultConsumption: true, tollsMkd: 0 } },
  }, {
    callId: "similar-1", tool: "find_similar_rides", args: { originCityId: 1, destinationCityId: 2, departureAt: "2026-09-23T15:00:00Z" },
    result: { rides: [{ id: "20000000-0000-4000-8000-000000000001", departureAt: "2026-09-23T15:30:00Z", pricePerSeatMkd: 150, seatsAvailable: 2 }] },
  }] }, true);
  expect(screen.getByText(/Fair share: 140 MKD per seat/)).toBeTruthy();
  expect(screen.getByText(/default approximation/)).toBeTruthy();
  expect(screen.getByText(/Possible duplicates:/)).toBeTruthy();
  expect(screen.getByRole("link", { name: /150 MKD per seat/ }).getAttribute("href")).toBe("/rides/20000000-0000-4000-8000-000000000001");
  expect(screen.getByRole("link", { name: "Continue to editable ride form" })).toBeTruthy();
});
