import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  userId: "driver" as string | null,
  ride: { id: "40000000-0000-4000-8000-000000000001", driver_id: "driver", status: "published", departure_at: "2026-09-20T12:00:00Z", seats_available: 1, seats_total: 3 },
  booking: { id: "50000000-0000-4000-8000-000000000001", ride_id: "40000000-0000-4000-8000-000000000001", seats: 2, status: "requested" },
  failWrite: false,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: fixture.userId ? { id: fixture.userId } : null } }) },
    from: (table: string) => {
      const row = table === "rides" ? fixture.ride : fixture.booking;
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let changes: Record<string, unknown> | undefined;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push((record) => record[key] === value); return query; },
        in: (key: string, values: unknown[]) => { filters.push((record) => values.includes(record[key])); return query; },
        lt: (key: string, value: string) => { filters.push((record) => String(record[key]) < value); return query; },
        gt: (key: string, value: string) => { filters.push((record) => String(record[key]) > value); return query; },
        update: (value: Record<string, unknown>) => { changes = value; return query; },
        maybeSingle: async () => {
          if (changes && fixture.failWrite) return { data: null, error: { message: "Unavailable" } };
          if (!filters.every((matches) => matches(row))) return { data: null, error: null };
          if (changes) Object.assign(row, changes);
          return { data: { ...row }, error: null };
        },
      };
      return query;
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(decodeURIComponent(url)); } }));

import { cancelRide, completeRide } from "./actions";
import { decideBooking } from "../../app/dashboard/actions";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-21T12:00:00Z"));
  fixture.userId = "driver";
  fixture.ride.status = "published";
  fixture.ride.driver_id = "driver";
  fixture.ride.departure_at = "2026-09-20T12:00:00Z";
  fixture.ride.seats_available = 1;
  fixture.ride.seats_total = 3;
  fixture.booking.status = "requested";
  fixture.booking.seats = 2;
  fixture.failWrite = false;
});
afterEach(() => vi.useRealTimers());

describe("completeRide", () => {
  it("lets the driver complete a departed ride and safely retry", async () => {
    expect(await completeRide(fixture.ride.id)).toEqual({ success: true, message: "Ride marked completed." });
    expect(await completeRide(fixture.ride.id)).toEqual({ success: true, message: "This ride is already completed." });
  });
  it.each([null, "other-driver"])("rejects completion by %s", async (userId) => {
    fixture.userId = userId;
    expect(await completeRide(fixture.ride.id)).toMatchObject({ success: false });
  });
  it.each(["draft", "cancelled"])("rejects a %s ride", async (status) => {
    fixture.ride.status = status;
    expect(await completeRide(fixture.ride.id)).toMatchObject({ success: false });
  });
  it.each(["2026-09-21T12:00:00Z", "2026-09-22T12:00:00Z"])("rejects departure at or after now (%s)", async (departure) => {
    fixture.ride.departure_at = departure;
    expect(await completeRide(fixture.ride.id)).toMatchObject({ success: false });
  });
  it("completes a full ride", async () => {
    fixture.ride.status = "full";
    expect(await completeRide(fixture.ride.id)).toMatchObject({ success: true });
  });
  it("reports invalid input and database failures", async () => {
    expect(await completeRide("bad-id")).toMatchObject({ success: false });
    fixture.failWrite = true;
    expect(await completeRide(fixture.ride.id)).toMatchObject({ success: false });
    fixture.failWrite = false;
    expect(await completeRide(fixture.ride.id)).toMatchObject({ success: true });
  });
  it("prevents approving a pending booking after completion", async () => {
    fixture.booking.seats = 1;
    await completeRide(fixture.ride.id);
    await expect(decideBooking(fixture.booking.id, "accepted")).rejects.toThrow("This ride is no longer accepting booking decisions.");
  });
  it("preserves accepted bookings and seat counts when completing", async () => {
    fixture.booking.status = "accepted";
    await completeRide(fixture.ride.id);
    expect(fixture.booking).toMatchObject({ status: "accepted", seats: 2 });
    expect(fixture.ride).toMatchObject({ seats_available: 1, seats_total: 3 });
  });
});

describe("cancelRide", () => {
  it("lets a driver cancel their future published ride", async () => {
    fixture.ride.departure_at = "2026-09-22T12:00:00Z";

    expect(await cancelRide(fixture.ride.id, false)).toEqual({
      success: true,
      message: "Ride cancelled. Confirmed passengers will see the cancellation in My trips.",
    });
    expect(fixture.ride.status).toBe("cancelled");
  });

  it("requires an explicit acknowledgement before cancelling a full ride", async () => {
    fixture.ride.status = "full";
    fixture.ride.seats_available = 0;
    fixture.ride.departure_at = "2026-09-22T12:00:00Z";

    expect(await cancelRide(fixture.ride.id, false)).toEqual({
      success: false,
      message: "This ride is full. Confirm that you understand passengers will need to make other plans.",
    });
    expect(fixture.ride.status).toBe("full");
    expect(await cancelRide(fixture.ride.id, true)).toMatchObject({ success: true });
  });

  it.each([
    [null, "published", "2026-09-22T12:00:00Z"],
    ["other-driver", "published", "2026-09-22T12:00:00Z"],
    ["driver", "draft", "2026-09-22T12:00:00Z"],
    ["driver", "completed", "2026-09-22T12:00:00Z"],
    ["driver", "cancelled", "2026-09-22T12:00:00Z"],
    ["driver", "published", "2026-09-20T12:00:00Z"],
  ] as const)("rejects an ineligible cancellation", async (userId, status, departureAt) => {
    fixture.userId = userId;
    fixture.ride.status = status;
    fixture.ride.departure_at = departureAt;

    expect(await cancelRide(fixture.ride.id, true)).toMatchObject({ success: false });
  });
});

describe("booking decisions", () => {
  it.each(["draft", "cancelled", "completed"])("rejects decisions on a %s ride", async (status) => {
    fixture.ride.status = status;
    fixture.ride.departure_at = "2026-09-22T12:00:00Z";
    await expect(decideBooking(fixture.booking.id, "declined")).rejects.toThrow("no longer accepting booking decisions");
  });
  it("rejects decisions when departure has arrived", async () => {
    fixture.ride.departure_at = "2026-09-21T12:00:00Z";
    await expect(decideBooking(fixture.booking.id, "declined")).rejects.toThrow("no longer accepting booking decisions");
  });
  it.each(["accepted", "declined"] as const)("still permits an eligible %s decision", async (decision) => {
    fixture.ride.departure_at = "2026-09-22T12:00:00Z";
    fixture.booking.seats = 1;
    await expect(decideBooking(fixture.booking.id, decision)).rejects.toThrow(`success=Request ${decision}.`);
  });
  it("preserves capacity and ownership checks", async () => {
    fixture.ride.departure_at = "2026-09-22T12:00:00Z";
    await expect(decideBooking(fixture.booking.id, "accepted")).rejects.toThrow("no longer has enough available seats");
    fixture.userId = "other-driver";
    await expect(decideBooking(fixture.booking.id, "declined")).rejects.toThrow("cannot manage this request");
  });
});
