import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  summary: { data: [{ average: null as number | null, count: 0 }], error: null as null | { message: string } },
  ratings: [] as Record<string, unknown>[],
  queries: [] as string[],
  failRead: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  rpc: () => db.summary,
  from: (table: string) => {
    db.queries.push(table);
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return query; },
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: db.ratings.filter((row) => filters.every((matches) => matches(row))), error: db.failRead ? { message: "unavailable" } : null }).then(resolve),
    };
    return query;
  },
}) }));

import { getProfileRatingSummary, getRatingControls } from "./queries";
const profileId = "20000000-0000-4000-8000-000000000001";
beforeEach(() => { db.summary = { data: [{ average: null, count: 0 }], error: null }; db.ratings = []; db.queries = []; db.failRead = false; });

describe("profile summary", () => {
  it("returns the honest empty state", async () => {
    expect(await getProfileRatingSummary(profileId)).toEqual({ average: null, count: 0 });
    expect(db.queries).toEqual([]);
  });
  it.each([{ average: 4, count: 1 }, { average: 3.25, count: 4 }])("returns a valid summary %j without fetching raw rows", async (summary) => {
    db.summary.data = [summary];
    expect(await getProfileRatingSummary(profileId)).toEqual(summary);
    expect(db.queries).toEqual([]);
  });
  it("strips unexpected private fields from RPC output", async () => {
    db.summary.data = [Object.assign({ average: 4, count: 1 }, { note: "private", rater_id: "hidden", ride_id: "hidden" })];
    expect(await getProfileRatingSummary(profileId)).toEqual({ average: 4, count: 1 });
  });
  it.each([{ average: 5, count: 0 }, { average: null, count: 2 }, { average: 6, count: 1 }, { average: 4, count: -1 }])("rejects malformed aggregate %j", async (summary) => {
    db.summary.data = [summary];
    expect(await getProfileRatingSummary(profileId)).toBeNull();
  });
  it("distinguishes unavailable results from no ratings", async () => {
    db.summary.error = { message: "Unavailable" };
    expect(await getProfileRatingSummary(profileId)).toBeNull();
    db.summary.error = null;
    db.summary.data = [];
    expect(await getProfileRatingSummary(profileId)).toBeNull();
    expect(await getProfileRatingSummary("bad-id")).toBeNull();
  });
});

describe("dashboard rating controls", () => {
  const ride = { id: "ride", driver_id: "driver", status: "completed" as const };
  const bookings = [
    { ride_id: "ride", passenger_id: "passenger", status: "accepted" as const },
    { ride_id: "ride", passenger_id: "second", status: "accepted" as const },
    { ride_id: "ride", passenger_id: "pending", status: "requested" as const },
  ];
  it("loads submitted feedback and remaining targets together, only for the current rater", async () => {
    db.ratings = [
      { ride_id: "ride", rater_id: "driver", ratee_id: "passenger", score: 4, note: "Private" },
      { ride_id: "ride", rater_id: "passenger", ratee_id: "driver", score: 1, note: "Received" },
    ];
    const controls = await getRatingControls("driver", [ride], bookings);
    expect(controls.get("ride")?.get("passenger")).toEqual({ status: "submitted", rating: { score: 4, note: "Private" } });
    expect(controls.get("ride")?.get("second")).toEqual({ status: "eligible" });
    expect(controls.get("ride")?.has("pending")).toBe(false);
    expect(db.queries).toEqual(["ratings"]);
  });
  it("shows passengers only their actual driver and no controls to unrelated users", async () => {
    const controls = await getRatingControls("passenger", [ride], bookings);
    expect([...controls.get("ride")!.keys()]).toEqual(["driver"]);
    expect((await getRatingControls("unrelated", [ride], bookings)).size).toBe(0);
  });
  it("hides non-completed and unclaimed rides and cancelled bookings", async () => {
    expect((await getRatingControls("passenger", [{ ...ride, status: "published" }, { ...ride, driver_id: null }], bookings)).size).toBe(0);
    expect(db.queries).toHaveLength(0);
    expect((await getRatingControls("passenger", [ride], [{ ...bookings[0], status: "cancelled" }])).size).toBe(0);
  });
  it("fails closed when existing ratings cannot be loaded", async () => {
    db.failRead = true;
    await expect(getRatingControls("driver", [ride], bookings)).rejects.toThrow("Unable to load");
  });
  it("batches large dashboards instead of querying each participant", async () => {
    const rides = Array.from({ length: 101 }, (_, index) => ({ ...ride, id: `ride-${index}` }));
    const accepted = rides.flatMap((entry) => Array.from({ length: 8 }, (_, index) => ({ ride_id: entry.id, passenger_id: `passenger-${index}`, status: "accepted" as const })));
    const controls = await getRatingControls("driver", rides, accepted);
    expect(controls.size).toBe(101);
    expect(controls.get("ride-100")?.size).toBe(8);
    expect(db.queries).toEqual(["ratings", "ratings"]);
  });
});
