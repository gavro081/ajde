import "server-only";
import { phoneSchema } from "../profiles/contact";
import { isAllowedStudentEmail } from "../auth/email-domain";
import { createClient } from "../supabase/server";
import { compareMessages, historySchema, PAGE_SIZE, roomMembership, rosterIds, sendSchema,
  type Message, type Result, type RoomPage } from "./contract";

const unavailable = { ok: false, code: "unavailable", error: "This ride room is unavailable." } as const;
const database = { ok: false, code: "database", error: "The room could not be loaded. Please retry." } as const;
const messageColumns = "id, ride_id, sender_id, recipient_id, body, created_at";

export async function roomAccess(rideId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !user.email || !isAllowedStudentEmail(user.email)) return unavailable;
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("full_name, photo_url, university, phone").eq("id", user.id).maybeSingle();
  if (profileError) return database;
  if (!profile?.full_name.trim() || !profile.photo_url.trim() || !profile.university.trim() || !phoneSchema.safeParse(profile.phone).success) return unavailable;
  const { data: ride, error } = await supabase.from("rides").select("id, driver_id, status, departure_at").eq("id", rideId).maybeSingle();
  if (error) return database;
  if (!ride) return unavailable;
  // Capacity is at most eight accepted seats, so this cannot hit the API row cap.
  const { data: bookings, error: bookingError } = await supabase.from("bookings")
    .select("passenger_id, status, decided_at").eq("ride_id", rideId).eq("status", "accepted");
  if (bookingError || !bookings) return database;
  const membership = roomMembership(user.id, ride, bookings);
  if (!membership.ok) return unavailable;
  return { ok: true, supabase, user, ride, bookings, membership: membership.value } as const;
}

export async function queryRoom(input: unknown): Promise<Result<RoomPage>> {
  const parsed = historySchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", error: "Invalid room or message cursor." };
  try {
    const { rideId, cursor, direction } = parsed.data;
    const access = await roomAccess(rideId);
    if (!access.ok) return access;
    const { supabase, membership } = access;
    const ids = rosterIds(access.ride, access.bookings);
    const { data: profiles, error: rosterError } = await supabase.from("profiles")
      .select("id, full_name, photo_url, phone, social_url, instagram, facebook").in("id", ids);
    if (rosterError || !profiles) return database;
    let query = supabase.from("messages").select(messageColumns).eq("ride_id", rideId).is("recipient_id", null);
    const forward = direction === "newer" && cursor !== null;
    if (cursor) {
      const op = forward ? "gt" : "lt";
      query = query.or(`created_at.${op}.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.${op}.${cursor.id})`);
    }
    const { data: rows, error } = await query.order("created_at", { ascending: forward })
      .order("id", { ascending: forward }).limit(PAGE_SIZE);
    if (error || !rows) return database;
    // Fetch historical senders separately: former members remain authors but not roster members.
    const senderIds = [...new Set(rows.map(m => m.sender_id))];
    const { data: senders, error: senderError } = senderIds.length
      ? await supabase.from("profiles").select("id, full_name, photo_url").in("id", senderIds)
      : { data: [], error: null };
    if (senderError) return database;
    const messages: Message[] = rows.filter(m => m.recipient_id === null).map(m => {
      const sender = senders?.find(s => s.id === m.sender_id);
      return { ...m, recipient_id: null, sender: sender ? { full_name: sender.full_name, photo_url: sender.photo_url } : null };
    });
    const edge = rows.at(-1);
    return { ok: true, value: { viewerId: access.user.id, membership,
      members: profiles.map(p => ({ ...p, isDriver: p.id === access.ride.driver_id })),
      messages: messages.sort(compareMessages),
      nextCursor: rows.length === PAGE_SIZE && edge ? { id: edge.id, created_at: edge.created_at } : null } };
  } catch { return database; }
}

export async function insertRoomMessage(input: unknown): Promise<Result<Message>> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", error: parsed.error.issues[0]?.message ?? "Invalid message." };
  try {
    const access = await roomAccess(parsed.data.rideId);
    if (!access.ok) return access;
    if (!access.membership.canSend) return { ok: false, code: "closed", error: "This room is read-only. Sending ends when the ride is cancelled or 48 hours after departure." };
    const { data, error } = await access.supabase.from("messages")
      .insert({ ride_id: parsed.data.rideId, sender_id: access.user.id, recipient_id: null, body: parsed.data.body })
      .select(messageColumns).single();
    if (error || !data) return error?.code === "42501" ? unavailable : { ...database, error: "Message was not confirmed. Check the timeline before retrying." };
    const { data: sender } = await access.supabase.from("profiles").select("full_name, photo_url").eq("id", access.user.id).maybeSingle();
    return { ok: true, value: { ...data, recipient_id: null, sender: sender ?? null } };
  } catch { return { ...database, error: "Message was not confirmed. Check the timeline before retrying." }; }
}
