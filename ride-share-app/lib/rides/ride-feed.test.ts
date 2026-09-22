import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rides: [] as Record<string, unknown>[], failAt: -1, ranges: [] as number[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  from(table: string) {
    const builder = {
      select: () => builder, in: () => builder, gte: () => builder, lt: () => builder,
      eq: () => builder, order: () => builder,
      range: async (from: number, to: number) => {
        db.ranges.push(from);
        return { data: db.rides.slice(from, to + 1), error: from === db.failAt ? new Error("offline") : null };
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({ data: table === "cities" ? [
          { id: 1, name_en: "Skopje", name_mk: "Скопје" }, { id: 8, name_en: "Ohrid", name_mk: "Охрид" },
        ] : table === "profiles" ? [{ id: "driver", gender: "woman" }] : [], error: null }).then(resolve);
      },
    };
    return builder;
  },
}) }));

import { getRideFeed } from "./ride-view";
import { parseRideFilters } from "./ride-filters";

beforeEach(() => { db.rides = []; db.ranges = []; db.failAt = -1; });
const ride = (id: number, departure: string) => ({ id: String(id), departure_at: departure,
  origin_city_id: 1, dest_city_id: 8, driver_id: "driver", car_id: null,
  origin_pickup_id: null, dest_pickup_id: null });

describe("ride feed recurring time pagination", () => {
  it("finds matches after an entire page of nonmatching rides, including with a gender filter", async () => {
    db.rides = Array.from({ length: 100 }, (_, i) => ride(i, "2026-09-22T08:00:00Z"));
    db.rides.push(ride(100, "2026-09-22T15:00:00Z"), ride(101, "2026-09-23T15:00:00Z"));
    const result = await getRideFeed(parseRideFilters({ timeAfter: "16:00", timeBefore: "18:00", sameGender: "1" }),
      { now: new Date("2026-09-21T10:00:00Z"), passengerGender: "woman" });
    expect(result.map((row) => row.id)).toEqual(["100", "101"]);
    expect(db.ranges).toEqual([0, 100]);
  });
  it("stops once 100 matching rides are available", async () => {
    db.rides = Array.from({ length: 200 }, (_, i) => ride(i, "2026-09-22T15:00:00Z"));
    expect(await getRideFeed(parseRideFilters({ timeAfter: "16:00" }))).toHaveLength(100);
    expect(db.ranges).toEqual([0]);
  });
  it("does not return misleading partial results when a later page fails", async () => {
    db.rides = Array.from({ length: 100 }, (_, i) => ride(i, "2026-09-22T08:00:00Z"));
    db.failAt = 100;
    await expect(getRideFeed(parseRideFilters({ timeAfter: "16:00" }))).rejects.toThrow("Unable to load rides.");
  });
});
