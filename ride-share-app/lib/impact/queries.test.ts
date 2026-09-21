import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown> & { id: string };
const database = vi.hoisted(() => ({
  rides: [] as Row[], bookings: [] as Row[],
  userId: "passenger-a" as string | null,
  failure: "", responseLimit: 1000,
}));

vi.mock("server-only", () => ({}));
vi.mock("../auth/session", () => ({ getCurrentUser: async () => database.userId ? { id: database.userId } : null }));
vi.mock("../supabase/server", () => ({ createClient: async () => ({
  from(table: "rides" | "bookings") {
    let rows = database[table].slice();
    let limit = database.responseLimit;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query; },
      lt: (key: string, value: string) => { rows = rows.filter(row => String(row[key]) < value); return query; },
      gt: (key: string, value: string) => { rows = rows.filter(row => String(row[key]) > value); return query; },
      in: (key: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[key])); return query; },
      order: (key: string) => { rows.sort((a, b) => String(a[key]).localeCompare(String(b[key]))); return query; },
      limit: (value: number) => { limit = Math.min(value, database.responseLimit); return query; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: database.failure === table ? null : rows.slice(0, limit),
        error: database.failure === table ? { message: "Database unavailable" } : null,
      }).then(resolve),
    };
    return query;
  },
}) }));

import { getImpactSummary } from "./queries";

function ride(id = "ride-1", overrides: Record<string, unknown> = {}): Row {
  return { id, status: "completed", departure_at: "2026-09-20T10:00:00.000Z", details: { distance_km: 100 },
    car: { fuel_type: "petrol", consumption_l_100km: 7 }, driver_id: "driver", ...overrides };
}
function booking(id: string, passenger = "passenger-a", seats = 1, rideId = "ride-1"): Row {
  return { id, ride_id: rideId, passenger_id: passenger, seats, status: "accepted" };
}

beforeEach(() => {
  database.rides = [ride()];
  database.bookings = [booking("booking-1", "passenger-a", 2), booking("booking-2", "passenger-b")];
  database.userId = "passenger-a";
  database.failure = "";
  database.responseLimit = 1000;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-21T12:00:00.000Z"));
});
afterEach(() => vi.useRealTimers());

describe("passenger impact query", () => {
  it("attributes petrol savings to accepted seats and counts the platform ride once", async () => {
    const summary = await getImpactSummary();
    expect(summary.personal).toEqual({ savedCo2Kg: 32.34, eligibleTrips: 1, includedTrips: 1, excludedTrips: 0 });
    expect(summary.platform).toEqual({ savedCo2Kg: 48.51, eligibleTrips: 1, includedTrips: 1, excludedTrips: 0 });
  });

  it("reports missing and unsupported data as excluded trips once per relevant scope", async () => {
    database.rides = [ride("ride-1", { car: null }), ride("ride-2", { car: { fuel_type: "electric", consumption_l_100km: 7 } })];
    database.bookings.push(booking("booking-3", "passenger-b", 1, "ride-2"));
    const summary = await getImpactSummary();
    expect(summary.personal).toEqual({ savedCo2Kg: 0, eligibleTrips: 1, includedTrips: 0, excludedTrips: 1 });
    expect(summary.platform).toEqual({ savedCo2Kg: 0, eligibleTrips: 2, includedTrips: 0, excludedTrips: 2 });
  });

  it.each([2, 1000])("traverses more than 1000 rides and bookings with response cap %s", async responseLimit => {
    database.responseLimit = responseLimit;
    database.rides = Array.from({ length: 1105 }, (_, i) => ride(`ride-${String(i).padStart(4, "0")}`));
    database.bookings = database.rides.flatMap(row => [
      booking(`${row.id}-a`, "passenger-a", 2, row.id),
      booking(`${row.id}-b`, "passenger-b", 1, row.id),
      booking(`${row.id}-c`, "passenger-c", 1, row.id),
    ]);
    const summary = await getImpactSummary();
    expect(summary.personal).toEqual({ savedCo2Kg: 35735.7, eligibleTrips: 1105, includedTrips: 1105, excludedTrips: 0 });
    expect(summary.platform).toEqual({ savedCo2Kg: 71471.4, eligibleTrips: 1105, includedTrips: 1105, excludedTrips: 0 });
  });

  it("uses the diesel snapshot and attributes no passenger savings to the driver", async () => {
    database.rides = [ride("ride-1", { details: { distance_km: 200 }, car: { fuel_type: "diesel", consumption_l_100km: 5 } })];
    database.bookings = [booking("booking-1")];
    expect((await getImpactSummary()).personal.savedCo2Kg).toBe(26.8);
    database.userId = "driver";
    const summary = await getImpactSummary();
    expect(summary.personal).toEqual({ savedCo2Kg: 0, eligibleTrips: 0, includedTrips: 0, excludedTrips: 0 });
    expect(summary.platform.savedCo2Kg).toBe(26.8);
  });

  it("reflects cancellations and repeated reads of completed state without accumulating credit", async () => {
    expect((await getImpactSummary()).platform.savedCo2Kg).toBe(48.51);
    expect((await getImpactSummary()).platform.savedCo2Kg).toBe(48.51);
    database.bookings[0].status = "cancelled";
    const summary = await getImpactSummary();
    expect(summary.personal).toEqual({ savedCo2Kg: 0, eligibleTrips: 0, includedTrips: 0, excludedTrips: 0 });
    expect(summary.platform).toEqual({ savedCo2Kg: 16.17, eligibleTrips: 1, includedTrips: 1, excludedTrips: 0 });
  });

  it.each(["published", "full", "draft", "cancelled"])("ignores %s rides", async status => {
    database.rides[0].status = status;
    expect((await getImpactSummary()).platform.eligibleTrips).toBe(0);
  });

  it.each(["requested", "declined", "cancelled"])("ignores %s bookings", async status => {
    database.bookings.forEach(row => { row.status = status; });
    expect((await getImpactSummary()).platform.eligibleTrips).toBe(0);
  });

  it("ignores future completed rides and counts them after departure", async () => {
    database.rides[0].departure_at = "2026-09-22T10:00:00.000Z";
    expect((await getImpactSummary()).platform.eligibleTrips).toBe(0);
    vi.setSystemTime(new Date("2026-09-22T10:00:01.000Z"));
    expect((await getImpactSummary()).platform.savedCo2Kg).toBe(48.51);
  });

  it.each([null, {}, [], { distance_km: null }, { distance_km: "100" }, { distance_km: -1 },
    { distance_km: 0 }, { distance_km: Infinity }, { distance_km: NaN }])("excludes invalid distance %j", async details => {
    database.rides[0].details = details;
    expect((await getImpactSummary()).platform).toEqual({ savedCo2Kg: 0, eligibleTrips: 1, includedTrips: 0, excludedTrips: 1 });
  });

  it.each([0, -1, Infinity, NaN])("excludes invalid consumption %s", async consumption => {
    database.rides[0].car = { fuel_type: "petrol", consumption_l_100km: consumption };
    expect((await getImpactSummary()).platform.excludedTrips).toBe(1);
  });

  it("returns empty history successfully with aggregate-only data and assumptions", async () => {
    database.rides = [];
    const summary = await getImpactSummary();
    expect(summary).toEqual({
      personal: { savedCo2Kg: 0, eligibleTrips: 0, includedTrips: 0, excludedTrips: 0 },
      platform: { savedCo2Kg: 0, eligibleTrips: 0, includedTrips: 0, excludedTrips: 0 },
      assumptions: expect.arrayContaining([expect.stringContaining("separate car"), expect.stringContaining("not immutable history")]),
    });
  });

  it("never exposes platform participants or trip records", async () => {
    expect(Object.keys(await getImpactSummary()).sort()).toEqual(["assumptions", "personal", "platform"]);
    expect(JSON.stringify(await getImpactSummary())).not.toMatch(/passenger-a|passenger-b|ride-1|driver_id|passenger_id/);
  });

  it.each(["rides", "bookings"])("fails instead of reporting zero when %s cannot be read", async table => {
    database.failure = table;
    await expect(getImpactSummary()).rejects.toThrow("Unable to load impact estimates.");
  });

  it("requires authentication", async () => {
    database.userId = null;
    await expect(getImpactSummary()).rejects.toThrow("Sign in");
  });

  it("excludes unrepresentable estimates instead of leaking Infinity into totals", async () => {
    database.rides[0].details = { distance_km: Number.MAX_VALUE };
    expect((await getImpactSummary()).platform).toEqual({ savedCo2Kg: 0, eligibleTrips: 1, includedTrips: 0, excludedTrips: 1 });
  });
});
