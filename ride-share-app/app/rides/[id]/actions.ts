"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { BOOKING_SEATS, bookingRequestSchema, requestEligibility } from "@/lib/bookings/validation";
import { canRequestSameGenderRide } from "@/lib/rides/gender-discovery";
import { createClient } from "@/lib/supabase/server";

function detailUrl(rideId: string, type: "success" | "error", message: string) {
  return `/rides/${rideId}?${type}=${encodeURIComponent(message)}`;
}

export async function requestBooking(rideId: string, formData: FormData) {
  const validation = bookingRequestSchema.safeParse({
    rideId,
    message: formData.get("message") ?? "",
  });
  if (!validation.success) redirect(detailUrl(rideId, "error", "Check your message and try again."));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/rides/${rideId}`)}`);

  const { data: ride, error } = await supabase
    .from("rides")
    .select("id, driver_id, departure_at, status, seats_available, gender_preference")
    .eq("id", rideId)
    .maybeSingle();
  if (error || !ride) redirect(detailUrl(rideId, "error", "This ride is no longer available."));

  const eligibilityError = requestEligibility({
    passengerId: user.id,
    driverId: ride.driver_id,
    departureAt: ride.departure_at,
    status: ride.status,
    requestedSeats: BOOKING_SEATS,
    availableSeats: ride.seats_available,
  });
  if (eligibilityError) redirect(detailUrl(rideId, "error", eligibilityError));

  if (ride.gender_preference === "same_as_driver" && ride.driver_id) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, gender")
      .in("id", [ride.driver_id, user.id]);
    const driverGender = profiles?.find((profile) => profile.id === ride.driver_id)?.gender;
    const passengerGender = profiles?.find((profile) => profile.id === user.id)?.gender;
    if (!canRequestSameGenderRide(driverGender, passengerGender)) {
      redirect(detailUrl(rideId, "error", "This driver accepts requests only from students of the same gender."));
    }
  }

  const { error: insertError } = await supabase.from("bookings").insert({
    ride_id: rideId,
    passenger_id: user.id,
    seats: BOOKING_SEATS,
    message: validation.data.message,
  });
  if (insertError) {
    const message = insertError.code === "23505"
      ? "You already have an active request for this ride."
      : "Your request could not be sent. Please try again.";
    redirect(detailUrl(rideId, "error", message));
  }

  revalidatePath(`/rides/${rideId}`);
  revalidatePath("/dashboard/trips");
  revalidatePath("/dashboard/driver");
  redirect(detailUrl(rideId, "success", "Seat request sent to the driver."));
}
