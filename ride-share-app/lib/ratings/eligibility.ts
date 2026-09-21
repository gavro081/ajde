import type { Tables } from "@/lib/supabase/database.types";

export type RatingRide = Pick<Tables<"rides">, "id" | "driver_id" | "status">;
export type RatingBooking = Pick<Tables<"bookings">, "ride_id" | "passenger_id" | "status">;
type RatingPair = Pick<Tables<"ratings">, "ride_id" | "rater_id" | "ratee_id">;

export function ratingEligibility({ currentUserId, ride, bookings, targetUserId, existingRatings }: {
  currentUserId: string | null;
  ride: RatingRide | null;
  bookings: readonly RatingBooking[];
  targetUserId: string;
  existingRatings: readonly RatingPair[];
}): "eligible" | "ineligible" | "already_rated" {
  if (!currentUserId || !ride?.driver_id || ride.status !== "completed" || currentUserId === targetUserId) {
    return "ineligible";
  }
  const passengerId = currentUserId === ride.driver_id ? targetUserId
    : targetUserId === ride.driver_id ? currentUserId : null;
  if (!passengerId || !bookings.some((booking) => booking.ride_id === ride.id
    && booking.passenger_id === passengerId && booking.status === "accepted")) {
    return "ineligible";
  }
  return existingRatings.some((rating) => rating.ride_id === ride.id
    && rating.rater_id === currentUserId && rating.ratee_id === targetUserId)
    ? "already_rated" : "eligible";
}
