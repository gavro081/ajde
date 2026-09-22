// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RideCheckSummary } from "./ride-check-summary";
import type { CheckTraceEntry } from "@/lib/ai/ride-check-contract";

afterEach(cleanup);
const entry: CheckTraceEntry = { callId: "similar-1", tool: "find_similar_rides", args: { originCityId: 1, destinationCityId: 2, departureAt: "2026-09-22T14:00:00Z" }, result: { rides: [{ id: "20000000-0000-4000-8000-000000000001", departureAt: "2026-09-22T14:00:00Z", pricePerSeatMkd: 150, seatsAvailable: 2 }] } };
const cities = [{ id: 1, name_en: "Skopje" }, { id: 2, name_en: "Veles" }];

it("shows possible duplicate links with Skopje departure, per-seat price, and available seats", () => {
  render(<RideCheckSummary check={{ status: "checked", trace: [entry] }} cities={cities} />);
  expect(screen.getByText(/Possible duplicates: Skopje/)).toBeTruthy();
  expect(screen.getByRole("link", { name: /22\/09\/2026.*16:00.*150 MKD per seat.*2 available seats/ }).getAttribute("href")).toBe("/rides/20000000-0000-4000-8000-000000000001");
  expect(screen.getByText(/Review these matches before deciding whether to publish/)).toBeTruthy();
});

it("distinguishes a successful empty search from unavailable search", () => {
  const view = render(<RideCheckSummary check={{ status: "checked", trace: [{ ...entry, result: { rides: [] } }] }} cities={cities} />);
  expect(screen.getByText(/No published or full ride offers found/)).toBeTruthy();
  expect(screen.queryByText(/Similar-ride search unavailable/)).toBeNull();
  view.rerender(<RideCheckSummary check={{ status: "unavailable", trace: [{ ...entry, result: { error: "Database unavailable" } }] }} cities={cities} />);
  expect(screen.getByText(/Similar-ride search unavailable: Database unavailable/)).toBeTruthy();
  expect(screen.queryByText(/No published or full ride offers found/)).toBeNull();
});
