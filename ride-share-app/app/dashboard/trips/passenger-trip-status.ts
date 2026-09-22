import type { Database } from "@/lib/supabase/database.types";
import type { TripStatusFilter } from "./trip-tabs";

type BookingStatus = Database["public"]["Enums"]["booking_status"];
type RideStatus = Database["public"]["Enums"]["ride_status"];

/** A ride's completion only counts as a passenger trip when their booking was accepted. */
export function passengerTripStatus(booking: BookingStatus, ride: RideStatus): {
  filter: Exclude<TripStatusFilter, "all"> | null;
  label: string;
} {
  if (booking === "cancelled") return { filter: "cancelled", label: "Booking cancelled" };
  if (booking === "declined") return { filter: null, label: "Request declined" };
  if (ride === "cancelled") return { filter: "cancelled", label: "Ride cancelled" };
  if (ride === "completed") {
    return booking === "accepted"
      ? { filter: "completed", label: "Completed" }
      : { filter: null, label: "Request closed" };
  }
  return { filter: "active", label: booking === "accepted" ? "Confirmed" : "Awaiting approval" };
}
