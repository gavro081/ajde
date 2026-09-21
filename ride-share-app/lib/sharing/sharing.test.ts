import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: "passenger" as string | null,
  rows: {} as Record<string, Record<string, unknown>[]>,
  fail: false,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: db.user ? { id: db.user } : null } }) },
  from(table: string) {
    const filters: ((row: Record<string, unknown>) => boolean)[] = [];
    let operation = "read";
    let value: Record<string, unknown> = {};
    let max = Infinity;
    const query = {
      select: () => query,
      eq: (key: string, expected: unknown) => { filters.push(row => row[key] === expected); return query; },
      gt: (key: string, expected: string) => { filters.push(row => String(row[key]) > expected); return query; },
      order: () => query,
      limit: (count: number) => { max = count; return query; },
      insert: (record: Record<string, unknown>) => { operation = "insert"; value = record; return query; },
      delete: () => { operation = "delete"; return query; },
      maybeSingle: async () => {
        const result = execute();
        return { ...result, data: result.data?.[0] ?? null };
      },
      single: async () => query.maybeSingle(),
      then: (resolve: (result: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
    };
    function execute() {
      if (db.fail) return { data: null, error: { message: "Database unavailable" } };
      const rows = db.rows[table] ?? [];
      if (operation === "insert") {
        const inserted = { id: "33333333-3333-4333-8333-333333333333", token: (rows.length ? "b" : "a").repeat(48), ...value };
        rows.push(inserted);
        return { data: [inserted], error: null };
      }
      const selected = rows.filter(row => filters.every(filter => filter(row))).slice(0, max);
      if (operation === "delete") db.rows[table] = rows.filter(row => !selected.includes(row));
      return { data: selected, error: null };
    }
    return query;
  },
}) }));

import { createTripShare, revokeTripShare } from "./actions";
import { getSharedItinerary } from "./queries";

const bookingId = "11111111-1111-4111-8111-111111111111";
const token = "a".repeat(48);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-21T10:00:00Z"));
  db.user = "passenger";
  db.fail = false;
  db.rows = {
    bookings: [{ id: bookingId, passenger_id: "passenger", status: "accepted", ride_id: "ride", message: "private booking message" }],
    rides: [{ id: "ride", status: "published", departure_at: "2026-09-22T12:00:00Z", driver_id: "driver", car_id: "car", origin_city_id: 1, dest_city_id: 2, origin_pickup_id: 1, dest_pickup_id: null, notes: "private note" }],
    profiles: [{ id: "driver", full_name: "Driver Student", photo_url: "https://example.com/photo.jpg", phone: "private phone", instagram: "private social" }],
    cars: [{ id: "car", make: "Toyota", model: "Yaris", color: "Blue", plate_last3: "123" }],
    cities: [{ id: 1, name_en: "Skopje" }, { id: 2, name_en: "Bitola" }],
    pickup_points: [{ id: 1, name_en: "Main station" }],
    trip_shares: [],
  };
});

afterEach(() => vi.useRealTimers());

describe("trip sharing actions and public query", () => {
  it("lets an accepted passenger create a share with a limited signed-out itinerary", async () => {
    const result = await createTripShare(bookingId);
    expect(result).toEqual({ ok: true, share: { id: "33333333-3333-4333-8333-333333333333", token, expiresAt: "2026-09-23T12:00:00.000Z" } });
    db.user = null;
    expect(await getSharedItinerary(token)).toEqual({
      origin: "Skopje", destination: "Bitola", pickup: "Main station", dropoff: null,
      departureAt: "2026-09-22T12:00:00Z",
      driver: { name: "Driver Student", photoUrl: "https://example.com/photo.jpg" },
      car: { make: "Toyota", model: "Yaris", color: "Blue" },
    });
  });

  it("reuses an active link and makes a revoked link unavailable", async () => {
    const first = await createTripShare(bookingId);
    expect(await createTripShare(bookingId)).toEqual(first);
    if (!first.ok) throw new Error("Expected a share");
    expect(await revokeTripShare(bookingId, first.share.id)).toEqual({ ok: true });
    expect(await getSharedItinerary(first.share.token)).toBeNull();
  });

  it.each([null, "other-passenger", "driver"])("rejects creation and revocation by %s without changing the existing link", async user => {
    const result = await createTripShare(bookingId);
    if (!result.ok) throw new Error("Expected a share");
    db.user = user;
    expect((await createTripShare(bookingId)).ok).toBe(false);
    expect((await revokeTripShare(bookingId, result.share.id)).ok).toBe(false);
    expect(await getSharedItinerary(result.share.token)).not.toBeNull();
  });

  it.each(["requested", "declined", "cancelled"])("rejects a %s booking and invalidates its earlier public share", async status => {
    const result = await createTripShare(bookingId);
    if (!result.ok) throw new Error("Expected a share");
    db.rows.bookings[0].status = status;
    expect((await createTripShare(bookingId)).ok).toBe(false);
    expect((await revokeTripShare(bookingId, result.share.id)).ok).toBe(false);
    expect(await getSharedItinerary(token)).toBeNull();
  });

  it("refuses cancelled rides and invalidates links on subsequent reads", async () => {
    await createTripShare(bookingId);
    expect(await getSharedItinerary(token)).not.toBeNull();
    db.rows.rides[0].status = "cancelled";
    expect((await createTripShare(bookingId)).ok).toBe(false);
    expect(await getSharedItinerary(token)).toBeNull();
  });

  it("expires exactly 24 hours after departure", async () => {
    await createTripShare(bookingId);
    vi.setSystemTime(new Date("2026-09-23T11:59:59.999Z"));
    expect(await getSharedItinerary(token)).not.toBeNull();
    vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
    expect(await getSharedItinerary(token)).toBeNull();
    expect((await createTripShare(bookingId)).ok).toBe(false);
  });

  it.each(["", "bad-token", "f".repeat(48)])("makes invalid or unknown token %s unavailable", async invalid => {
    await createTripShare(bookingId);
    expect(await getSharedItinerary(invalid)).toBeNull();
  });

  it("refuses forged identifiers without invalidating another share", async () => {
    const first = await createTripShare(bookingId);
    if (!first.ok) throw new Error("Expected a share");
    expect((await createTripShare("malformed")).ok).toBe(false);
    expect((await revokeTripShare("22222222-2222-4222-8222-222222222222", first.share.id)).ok).toBe(false);
    expect((await revokeTripShare(bookingId, "22222222-2222-4222-8222-222222222222")).ok).toBe(false);
    expect(await getSharedItinerary(token)).not.toBeNull();
  });

  it("fails closed when the database is unavailable", async () => {
    await createTripShare(bookingId);
    db.fail = true;
    expect((await createTripShare(bookingId)).ok).toBe(false);
    expect(await getSharedItinerary(token)).toBeNull();
  });

  it("also enforces the current departure window if the ride time changes", async () => {
    await createTripShare(bookingId);
    db.rows.rides[0].departure_at = "2026-09-20T09:00:00Z";
    expect(await getSharedItinerary(token)).toBeNull();
  });
});
