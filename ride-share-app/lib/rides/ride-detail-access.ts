import type { Tables } from "@/lib/supabase/database.types";

type RideStatus = Tables<"rides">["status"];
type BookingStatus = Tables<"bookings">["status"];

export function canViewRideDetail({
  rideStatus,
  isDriver,
  bookingStatus,
}: {
  rideStatus: RideStatus;
  isDriver: boolean;
  bookingStatus?: BookingStatus;
}) {
  if (isDriver || rideStatus === "published" || rideStatus === "full") return true;

  return (
    bookingStatus === "accepted" &&
    (rideStatus === "completed" || rideStatus === "cancelled")
  );
}
