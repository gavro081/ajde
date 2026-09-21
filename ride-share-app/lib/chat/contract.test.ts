import { describe, expect, it } from "vitest";
import { compareMessages, isRoomEvent, mergeMessages, roomMembership, rosterIds, sendSchema, type Message, type RoomBooking, type RoomRide } from "./contract";

const now = Date.parse("2026-09-21T12:00:00Z");
const ride: RoomRide = { id: "ride", driver_id: "driver", status: "published", departure_at: new Date(now).toISOString() };
const bookings: RoomBooking[] = ["one", "two"].map(passenger_id => ({ passenger_id, status: "accepted", decided_at: new Date(now - 1000).toISOString() }));
describe("room membership", () => {
  it.each(["driver", "one", "two"])("admits %s to the same room", user => {
    const result = roomMembership(user, ride, bookings, now);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.canSend).toBe(true);
  });
  it.each(["requested", "declined", "cancelled"] as const)("rejects %s passengers", status => {
    expect(roomMembership("one", ride, [{ ...bookings[0], status }], now).ok).toBe(false);
  });
  it("rejects signed-out, unrelated, unclaimed and future-acceptance users", () => {
    expect(roomMembership(null, ride, bookings, now).ok).toBe(false);
    expect(roomMembership("other", ride, bookings, now).ok).toBe(false);
    expect(roomMembership("one", { ...ride, driver_id: null }, bookings, now).ok).toBe(false);
    expect(roomMembership("one", ride, [{ ...bookings[0], decided_at: new Date(now + 1).toISOString() }], now).ok).toBe(false);
  });
  it.each(["cancelled", "completed"] as const)("retains history on %s rides", status => {
    const result = roomMembership("one", { ...ride, status }, bookings, now);
    expect(result.ok && result.value.canSend).toBe(status === "completed");
  });
  it("closes sends after exactly 48 hours and preserves history", () => {
    const end = now + 48 * 3600000;
    expect(roomMembership("driver", ride, [], end)).toMatchObject({ ok: true, value: { canSend: true } });
    expect(roomMembership("driver", ride, [], end + 1)).toMatchObject({ ok: true, value: { canSend: false } });
  });
  it("deduplicates roster members and excludes other booking states", () => {
    expect(rosterIds(ride, [...bookings, bookings[0], { passenger_id: "pending", status: "requested", decided_at: null }])).toEqual(["driver", "one", "two"]);
  });
});
describe("message contract", () => {
  const rideId = "92000000-0000-4000-8000-000000000001";
  it("trims and enforces the 1–2000 boundary", () => {
    expect(sendSchema.parse({ rideId, body: " hello " }).body).toBe("hello");
    expect(sendSchema.safeParse({ rideId, body: "  \n " }).success).toBe(false);
    expect(sendSchema.safeParse({ rideId, body: "x".repeat(2000) }).success).toBe(true);
    expect(sendSchema.safeParse({ rideId, body: "x".repeat(2001) }).success).toBe(false);
  });
  it("rejects forged sender, recipient and invalid ride IDs", () => {
    for (const extra of [{ sender_id: "forged" }, { recipient_id: rideId }]) {
      expect(sendSchema.safeParse({ rideId, body: "hello", ...extra }).success).toBe(false);
    }
    expect(sendSchema.safeParse({ rideId: "bad", body: "hello" }).success).toBe(false);
  });
  it("deduplicates action and Realtime echoes while preserving chronological order", () => {
    const message = { id: rideId, created_at: "2026-09-21T12:00:00.000001Z" } as Message;
    const newer = { ...message, id: rideId.replace(/1$/, "2"), created_at: "2026-09-21T12:00:00.000002Z" };
    expect(mergeMessages([newer], [message, newer])).toEqual([message, newer]);
    expect(compareMessages(message, newer)).toBeLessThan(0);
  });
  it("rejects wrong-ride and direct-message events", () => {
    const row = { id: rideId, ride_id: rideId, recipient_id: null };
    expect(isRoomEvent(row, rideId)).toBe(true);
    expect(isRoomEvent(row, "other")).toBe(false);
    expect(isRoomEvent({ ...row, recipient_id: rideId }, rideId)).toBe(false);
  });
});
