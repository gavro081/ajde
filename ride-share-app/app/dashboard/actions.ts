"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { bookingCancelSchema, bookingDecisionSchema } from "@/lib/bookings/validation";
import { createClient } from "@/lib/supabase/server";

function dashboardUrl(path: "driver" | "trips", type: "success" | "error", message: string) {
  return `/dashboard/trips?${path === "driver" ? "view=driver&" : ""}${type}=${encodeURIComponent(message)}`;
}

export async function decideBooking(bookingId: string, decision: "accepted" | "declined") {
  const validation = bookingDecisionSchema.safeParse({ bookingId, decision });
  if (!validation.success) redirect(dashboardUrl("driver", "error", "Invalid booking decision."));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fdashboard%2Ftrips%3Fview%3Ddriver");

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, ride_id, seats, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !booking) redirect(dashboardUrl("driver", "error", "Booking request not found."));

  const { data: ride } = await supabase
    .from("rides")
    .select("id, driver_id, seats_available, status, departure_at")
    .eq("id", booking.ride_id)
    .maybeSingle();
  if (!ride || ride.driver_id !== user.id) redirect(dashboardUrl("driver", "error", "You cannot manage this request."));
  if (!["published", "full"].includes(ride.status) || Date.parse(ride.departure_at) <= Date.now()) {
    redirect(dashboardUrl("driver", "error", "This ride is no longer accepting booking decisions."));
  }
  if (booking.status !== "requested") redirect(dashboardUrl("driver", "error", "This request was already decided."));
  if (decision === "accepted" && booking.seats > ride.seats_available) {
    redirect(dashboardUrl("driver", "error", "The ride no longer has enough available seats."));
  }

  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({ status: decision, decided_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("status", "requested")
    .select("id")
    .maybeSingle();
  if (updateError || !updated) {
    const message = updateError?.code === "23514"
      ? "Another accepted request filled the ride. Refresh and review the remaining seats."
      : "The request could not be updated.";
    redirect(dashboardUrl("driver", "error", message));
  }

  revalidatePath("/rides");
  revalidatePath(`/rides/${booking.ride_id}`);
  revalidatePath("/dashboard/driver");
  revalidatePath("/dashboard/trips");
  redirect(dashboardUrl("driver", "success", `Request ${decision}.`));
}

export async function cancelBooking(bookingId: string) {
  const validation = bookingCancelSchema.safeParse({ bookingId });
  if (!validation.success) redirect(dashboardUrl("trips", "error", "Invalid booking."));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/trips");

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, ride_id, passenger_id, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !booking || booking.passenger_id !== user.id) {
    redirect(dashboardUrl("trips", "error", "You cannot cancel this booking."));
  }
  if (!['requested', 'accepted'].includes(booking.status)) {
    redirect(dashboardUrl("trips", "error", "This booking is already closed."));
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: "cancelled", decided_at: null })
    .eq("id", bookingId)
    .eq("passenger_id", user.id)
    .in("status", ["requested", "accepted"]);
  if (updateError) redirect(dashboardUrl("trips", "error", "The booking could not be cancelled."));

  revalidatePath("/rides");
  revalidatePath(`/rides/${booking.ride_id}`);
  revalidatePath("/dashboard/driver");
  revalidatePath("/dashboard/trips");
  redirect(dashboardUrl("trips", "success", "Booking cancelled."));
}
