"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "../supabase/server";
import type { ShareResult } from "./types";

export async function createTripShare(bookingId: string): Promise<ShareResult> {
  if (!z.uuid().safeParse(bookingId).success) return { ok: false, error: "Invalid booking." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to share your trip." };
  const { data: booking, error: bookingError } = await supabase.from("bookings")
    .select("id, ride_id, passenger_id, status").eq("id", bookingId).eq("passenger_id", user.id).maybeSingle();
  if (bookingError || !booking || booking.status !== "accepted") return { ok: false, error: "Only your accepted bookings can be shared." };
  const { data: ride, error: rideError } = await supabase.from("rides")
    .select("status, departure_at").eq("id", booking.ride_id).maybeSingle();
  if (rideError || !ride || ride.status === "cancelled") return { ok: false, error: "This ride cannot be shared." };
  const expiry = new Date(ride.departure_at).getTime() + 24 * 60 * 60 * 1000;
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return { ok: false, error: "Sharing expired 24 hours after departure." };
  const { data: existing, error: existingError } = await supabase.from("trip_shares")
    .select("id, token, expires_at").eq("booking_id", bookingId).eq("expires_at", new Date(expiry).toISOString())
    .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existingError) return { ok: false, error: "Unable to load your trip link. Try again." };
  if (existing) return { ok: true, share: { id: existing.id, token: existing.token, expiresAt: existing.expires_at } };
  const { data: share, error } = await supabase.from("trip_shares")
    .insert({ booking_id: bookingId, expires_at: new Date(expiry).toISOString() })
    .select("id, token, expires_at").single();
  if (error || !share) return { ok: false, error: "Unable to create a trip link. Try again." };
  revalidatePath("/dashboard/trips");
  return { ok: true, share: { id: share.id, token: share.token, expiresAt: share.expires_at } };
}

export async function revokeTripShare(bookingId: string, shareId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.uuid().safeParse(bookingId).success || !z.uuid().safeParse(shareId).success) return { ok: false, error: "Invalid trip link." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to revoke your trip link." };
  const { data: booking, error: bookingError } = await supabase.from("bookings")
    .select("id, ride_id, status").eq("id", bookingId).eq("passenger_id", user.id).maybeSingle();
  if (bookingError || !booking || booking.status !== "accepted") return { ok: false, error: "Only your accepted bookings can be managed." };
  const { data: ride, error: rideError } = await supabase.from("rides")
    .select("status").eq("id", booking.ride_id).maybeSingle();
  if (rideError || !ride || ride.status === "cancelled") return { ok: false, error: "This ride is no longer shareable." };
  const { data, error } = await supabase.from("trip_shares").delete()
    .eq("id", shareId).eq("booking_id", bookingId).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Unable to revoke this trip link. It may already be removed." };
  revalidatePath("/dashboard/trips");
  return { ok: true };
}
