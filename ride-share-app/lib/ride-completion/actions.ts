"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export async function completeRide(rideId: string): Promise<{ success: boolean; message: string }> {
  if (!z.uuid().safeParse(rideId).success) return { success: false, message: "Invalid ride." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Sign in to complete your ride." };

  const { data: ride, error } = await supabase.from("rides")
    .select("id, driver_id, status, departure_at")
    .eq("id", rideId).eq("driver_id", user.id).maybeSingle();
  if (error || !ride) return { success: false, message: "Unable to find your ride." };
  if (ride.status === "completed") return { success: true, message: "This ride is already completed." };

  const now = new Date().toISOString();
  if (!["published", "full"].includes(ride.status) || Date.parse(ride.departure_at) >= Date.parse(now)) {
    return { success: false, message: "Only departed published or full rides can be completed." };
  }
  const { data: updated, error: updateError } = await supabase.from("rides")
    .update({ status: "completed" }).eq("id", rideId).eq("driver_id", user.id)
    .in("status", ["published", "full"]).lt("departure_at", now).select("id").maybeSingle();
  if (updateError) return { success: false, message: "Could not complete the ride. Please try again." };
  if (!updated) {
    const { data: current, error: readError } = await supabase.from("rides")
      .select("status").eq("id", rideId).eq("driver_id", user.id).maybeSingle();
    if (readError || current?.status !== "completed") {
      return { success: false, message: "The ride changed. Refresh before trying again." };
    }
  }

  revalidatePath("/dashboard/driver");
  revalidatePath("/dashboard/trips");
  revalidatePath("/rides");
  revalidatePath(`/rides/${rideId}`);
  return { success: true, message: "Ride marked completed." };
}
