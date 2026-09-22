// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { PassengerTrips } from "./passenger-trips";
import { TripStatusFilterNav } from "./trip-status-filter-nav";
import { parseTripStatusFilter, type TripStatusFilter } from "./trip-tabs";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/ratings/queries", () => ({ getRatingControls: vi.fn(async () => new Map()) }));
vi.mock("@/components/ratings/rating-control", () => ({ RatingControl: () => null }));
vi.mock("@/components/trip-share-controls", () => ({ TripShareControls: () => null }));
vi.mock("../actions", () => ({ cancelBooking: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const states = [
  ["accepted", "published"],
  ["requested", "full"],
  ["accepted", "completed"],
  ["cancelled", "completed"],
  ["accepted", "cancelled"],
  ["declined", "completed"],
  ["requested", "completed"],
] as const;
const bookings = states.map(([status], index) => ({
  id: `booking-${index}`, ride_id: `ride-${index}`, seats: 2, message: null,
  status, created_at: "2026-09-20T12:00:00Z",
}));
const rides = states.map(([, status], index) => ({
  id: `ride-${index}`, driver_id: "driver", departure_at: "2026-09-22T12:30:00Z",
  origin_city_id: 1, dest_city_id: 2, price_per_seat_mkd: 300, status,
}));
let tables: Record<string, unknown[]>;
const eq = vi.fn();

beforeEach(() => {
  tables = {
    bookings, rides,
    cities: [{ id: 1, name_en: "Skopje" }, { id: 2, name_en: "Bitola" }],
    profiles: [{ id: "driver", full_name: "Test Driver", phone: "+38970123456", instagram: null, facebook: null }],
  };
  eq.mockClear();
  vi.mocked(createClient).mockResolvedValue({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: (...args: unknown[]) => { eq(...args); return query; },
        order: async () => ({ data: tables[table], error: null }),
        in: async () => ({ data: tables[table], error: null }),
      };
      return query;
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
});
afterEach(cleanup);

it.each<[TripStatusFilter, number, string[]]>([
  ["active", 2, ["Confirmed", "Awaiting approval"]],
  ["completed", 1, ["Completed"]],
  ["cancelled", 2, ["Booking cancelled", "Ride cancelled"]],
  ["all", 7, ["Confirmed", "Awaiting approval", "Completed", "Booking cancelled", "Ride cancelled", "Request declined", "Request closed"]],
])("filters passenger trips by %s using both booking and ride status", async (filter, count, labels) => {
  render(await PassengerTrips({ userId: "passenger", filter }));
  expect(eq).toHaveBeenCalledWith("passenger_id", "passenger");
  const cards = screen.getAllByRole("article");
  expect(cards).toHaveLength(count);
  labels.forEach((label, index) => expect(within(cards[index]).getByText(label)).toBeTruthy());
  const nav = within(screen.getByRole("navigation", { name: "Filter passenger trips by status" }));
  for (const label of ["Active 2", "Completed 1", "Cancelled 2", "All 7"]) {
    expect(nav.getByRole("link", { name: label })).toBeTruthy();
  }
  expect(nav.getByRole("link", { current: "page" }).getAttribute("href"))
    .toBe(filter === "active" ? "/dashboard/trips" : `/dashboard/trips?status=${filter}`);
});

it("separates the departure, seat price, total and contact on confirmed cards", async () => {
  render(await PassengerTrips({ userId: "passenger", filter: "active" }));
  const confirmed = within(screen.getAllByRole("article")[0]);
  expect(confirmed.getByRole("heading", { name: "Skopje to Bitola" })).toBeTruthy();
  expect(confirmed.getByText("14:30")).toBeTruthy();
  expect(confirmed.getByText("300 MKD")).toBeTruthy();
  expect(confirmed.getByText("600 MKD total")).toBeTruthy();
  expect(confirmed.getByText("2 seats booked")).toBeTruthy();
  expect(confirmed.getByText("Test Driver")).toBeTruthy();
  expect(confirmed.getByRole("link", { name: /Open ride chat/ })).toBeTruthy();
  expect(confirmed.getByRole("button", { name: "Cancel booking", hidden: true })).toBeTruthy();
  expect(within(screen.getAllByRole("article")[1]).queryByText("Test Driver")).toBeNull();
});

it("does not offer cancellation for completed trips", async () => {
  render(await PassengerTrips({ userId: "passenger", filter: "completed" }));
  expect(screen.queryByRole("button", { name: "Cancel booking", hidden: true })).toBeNull();
});

it("shows a filter-specific empty state while retaining counts and navigation", async () => {
  tables.bookings = bookings.slice(0, 2);
  render(await PassengerTrips({ userId: "passenger", filter: "completed" }));
  expect(screen.getByRole("heading", { name: "No completed trips yet" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Active 2" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Completed 0" })).toBeTruthy();
  expect(screen.queryByRole("article")).toBeNull();
});

it("keeps driver filter links in the driver view", () => {
  render(<TripStatusFilterNav view="driver" filter="completed" counts={{ active: 2, completed: 1, cancelled: 0, all: 3 }}>Rides</TripStatusFilterNav>);
  expect(screen.getByRole("link", { name: "Completed 1" }).getAttribute("href")).toBe("/dashboard/trips?view=driver&status=completed");
  expect(screen.getByRole("link", { name: "Active 2" }).getAttribute("href")).toBe("/dashboard/trips?view=driver");
});

it("defaults unknown or absent status filters to active", () => {
  expect(parseTripStatusFilter(undefined)).toBe("active");
  expect(parseTripStatusFilter("invalid")).toBe("active");
});
