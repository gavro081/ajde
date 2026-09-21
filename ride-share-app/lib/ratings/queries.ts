import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ratingEligibility, type RatingBooking, type RatingRide } from "./eligibility";
import type { RatingControlState, RatingSummary } from "./types";

const summarySchema = z.object({ average: z.number().min(1).max(5).nullable(), count: z.number().int().nonnegative() })
  .refine((value) => value.count === 0 ? value.average === null : value.average !== null);

export async function getProfileRatingSummary(profileId: string): Promise<RatingSummary | null> {
  if (!z.uuid().safeParse(profileId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("profile_rating_summary", { target_profile_id: profileId });
  if (error || data?.length !== 1) return null;
  const result = summarySchema.safeParse(data[0]);
  return result.success ? result.data : null;
}

/** Only call with the authenticated user and server-loaded dashboard facts. */
export async function getRatingControls(currentUserId: string, rides: readonly RatingRide[], bookings: readonly RatingBooking[]) {
  const controls = new Map<string, Map<string, RatingControlState>>();
  const completedRides = rides.filter((ride) => ride.status === "completed" && ride.driver_id);
  if (!completedRides.length) return controls;
  const supabase = await createClient();
  // At most eight accepted passengers per ride: 100 rides fit below the API's
  // 1000-row limit, with one query per batch rather than one per participant.
  for (let offset = 0; offset < completedRides.length; offset += 100) {
    const batch = completedRides.slice(offset, offset + 100);
    const { data: ratings, error } = await supabase.from("ratings")
      .select("ride_id, rater_id, ratee_id, score, note")
      .eq("rater_id", currentUserId).in("ride_id", batch.map((ride) => ride.id));
    if (error) throw new Error("Unable to load your submitted ratings. Please try again.");
    for (const ride of batch) {
      const rideBookings = bookings.filter((booking) => booking.ride_id === ride.id);
      const targets = currentUserId === ride.driver_id
        ? rideBookings.filter((booking) => booking.status === "accepted").map((booking) => booking.passenger_id)
        : [ride.driver_id!];
      const rideControls = new Map<string, RatingControlState>();
      for (const targetUserId of new Set(targets)) {
        const eligibility = ratingEligibility({ currentUserId, ride, bookings: rideBookings, targetUserId, existingRatings: ratings ?? [] });
        if (eligibility === "eligible") rideControls.set(targetUserId, { status: "eligible" });
        if (eligibility === "already_rated") {
          const rating = ratings!.find((row) => row.ride_id === ride.id && row.ratee_id === targetUserId)!;
          rideControls.set(targetUserId, { status: "submitted", rating: { score: rating.score, note: rating.note } });
        }
      }
      if (rideControls.size) controls.set(ride.id, rideControls);
    }
  }
  return controls;
}
