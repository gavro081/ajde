import { z } from "zod";
import type { Tables } from "../supabase/database.types";

export const PAGE_SIZE = 50;
export const cursorSchema = z.object({ id: z.uuid(), created_at: z.iso.datetime({ offset: true }) }).strict();
export const historySchema = z.object({
  rideId: z.uuid(), cursor: cursorSchema.nullable().default(null),
  direction: z.enum(["older", "newer"]).default("older"),
}).strict();
export const sendSchema = z.object({
  rideId: z.uuid(),
  body: z.string().trim().min(1, "Write a message before sending.").max(2000, "Keep messages to 2000 characters."),
}).strict();
export type Cursor = z.infer<typeof cursorSchema>;
export type RoomRide = Pick<Tables<"rides">, "id" | "driver_id" | "status" | "departure_at">;
export type RoomBooking = Pick<Tables<"bookings">, "passenger_id" | "status" | "decided_at">;
export type Membership = { role: "driver" | "passenger"; joinedAt: string | null; canSend: boolean; closesAt: string };
export type Denial = "signed_out" | "unclaimed" | "not_member";
export type Member = { id: string; full_name: string; photo_url: string; isDriver: boolean };
export type Message = Cursor & { ride_id: string; sender_id: string; recipient_id: null; body: string; sender: Pick<Member, "full_name" | "photo_url"> | null };
export type RoomPage = { viewerId: string; membership: Membership; members: Member[]; messages: Message[]; nextCursor: Cursor | null };
export type Result<T> = { ok: true; value: T } | { ok: false; code: "unavailable" | "database" | "invalid" | "closed"; error: string };

export function roomMembership(userId: string | null, ride: RoomRide, bookings: RoomBooking[], now = Date.now()):
  { ok: true; value: Membership } | { ok: false; reason: Denial } {
  if (!userId) return { ok: false, reason: "signed_out" };
  if (!ride.driver_id) return { ok: false, reason: "unclaimed" };
  const driver = userId === ride.driver_id;
  const booking = bookings.find(b => b.passenger_id === userId && b.status === "accepted" &&
    b.decided_at !== null && Date.parse(b.decided_at) <= now);
  if (!driver && !booking) return { ok: false, reason: "not_member" };
  const closes = Date.parse(ride.departure_at) + 48 * 60 * 60 * 1000;
  return { ok: true, value: { role: driver ? "driver" : "passenger", joinedAt: driver ? null : booking!.decided_at,
    canSend: ride.status !== "cancelled" && now <= closes, closesAt: new Date(closes).toISOString() } };
}

export function rosterIds(ride: RoomRide, bookings: RoomBooking[]) {
  return ride.driver_id ? [...new Set([ride.driver_id, ...bookings.filter(b => b.status === "accepted").map(b => b.passenger_id)])] : [];
}

// Preserve PostgreSQL microseconds when sorting messages with identical millisecond timestamps.
export function compareMessages(a: Cursor, b: Cursor) {
  const micros = (s: string) => (s.match(/\.(\d+)/)?.[1] ?? "").padEnd(6, "0").slice(3, 6);
  return Date.parse(a.created_at) - Date.parse(b.created_at) || micros(a.created_at).localeCompare(micros(b.created_at)) || a.id.localeCompare(b.id);
}
export function mergeMessages(current: Message[], incoming: Message[]) {
  return [...new Map([...current, ...incoming].map(m => [m.id, m])).values()].sort(compareMessages);
}
export function isRoomEvent(row: Record<string, unknown>, rideId: string) {
  return row.ride_id === rideId && row.recipient_id === null && z.uuid().safeParse(row.id).success;
}
