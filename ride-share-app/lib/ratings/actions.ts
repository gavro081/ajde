"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { ratingEligibility } from "./eligibility";
import type { RatingActionState } from "./types";
import { ratingInputSchema } from "./validation";

export async function submitRating(_previous: RatingActionState, form: FormData): Promise<RatingActionState> {
  const input = ratingInputSchema.safeParse({
    rideId: form.get("rideId"), rateeId: form.get("rateeId"),
    score: Number(form.get("score")), note: form.get("note"),
  });
  if (!input.success) return { status: "error", message: "Choose a score from 1 to 5 and keep feedback within 1000 characters." };
  const { rideId, rateeId, score, note } = input.data;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { status: "error", message: "Sign in to rate a completed ride." };

  const [{ data: ride, error: rideError }, { data: bookings, error: bookingError }, { data: existing, error: ratingError }] = await Promise.all([
    supabase.from("rides").select("id, driver_id, status").eq("id", rideId).maybeSingle(),
    supabase.from("bookings").select("ride_id, passenger_id, status").eq("ride_id", rideId).eq("status", "accepted"),
    supabase.from("ratings").select("ride_id, rater_id, ratee_id, score, note")
      .eq("ride_id", rideId).eq("rater_id", user.id).eq("ratee_id", rateeId).maybeSingle(),
  ]);
  if (rideError || bookingError || ratingError) return { status: "error", message: "Could not check rating eligibility. Please try again." };
  const eligibility = ratingEligibility({ currentUserId: user.id, ride, bookings: bookings ?? [], targetUserId: rateeId, existingRatings: existing ? [existing] : [] });
  if (eligibility === "ineligible") return { status: "error", message: "You can only rate your driver or accepted passenger after the ride is completed." };
  if (eligibility === "already_rated") return { status: "already_rated", message: "You have already rated this person for this ride. Refresh to see your feedback." };

  const { error } = await supabase.from("ratings").insert({ ride_id: rideId, rater_id: user.id, ratee_id: rateeId, score, note });
  if (error?.code === "23505") return { status: "already_rated", message: "You have already rated this person for this ride. Refresh to see your feedback." };
  if (error) return { status: "error", message: "Your rating could not be saved. Please refresh and try again." };

  revalidatePath("/dashboard/trips");
  revalidatePath("/dashboard/driver");
  revalidatePath(`/profile/${rateeId}`);
  return { status: "submitted", message: "Rating submitted. Thank you for your feedback.", rating: { score, note } };
}
