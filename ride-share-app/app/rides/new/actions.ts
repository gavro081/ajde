"use server";

import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { issuesByPath, validateRideSubmission } from "@/lib/rides/ride-form";

export type CreateRideFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors: Record<string, string[]>;
  rideId?: string;
};

function databaseMessage(error: PostgrestError) {
  if (error.code === "23503") {
    return "One of the selected cities, pickup points, or car is no longer available.";
  }
  if (error.code === "23514") {
    return "The ride conflicts with a database safety rule. Review the form and try again.";
  }
  return "We could not save this ride. Please try again.";
}

export async function createRide(
  _previousState: CreateRideFormState,
  formData: FormData,
): Promise<CreateRideFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "Your session has expired. Sign in and try again.",
      fieldErrors: {},
    };
  }

  const validation = validateRideSubmission(formData);
  const issues = [
    ...(validation.draft.success ? [] : validation.draft.error.issues),
    ...(validation.metadata.success ? [] : validation.metadata.error.issues),
  ];

  if (!validation.draft.success || !validation.metadata.success) {
    return {
      status: "error",
      message: "Review the highlighted ride details.",
      fieldErrors: issuesByPath(issues),
    };
  }

  const draft = validation.draft.data;
  const { intent, submissionId } = validation.metadata.data;

  const { data: ownedCar, error: carError } = await supabase
    .from("cars")
    .select("id")
    .eq("id", draft.carId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (carError || !ownedCar) {
    return {
      status: "error",
      message: "Choose one of your saved cars.",
      fieldErrors: { carId: ["The selected car does not belong to your account."] },
    };
  }

  const { data: existingRide, error: duplicateLookupError } = await supabase
    .from("rides")
    .select("id")
    .eq("driver_id", user.id)
    .contains("details", { submission_id: submissionId })
    .maybeSingle();

  if (duplicateLookupError) {
    return {
      status: "error",
      message: "We could not verify this submission. Please try again.",
      fieldErrors: {},
    };
  }

  if (existingRide) {
    return {
      status: "success",
      message: "This ride was already saved; no duplicate was created.",
      fieldErrors: {},
      rideId: existingRide.id,
    };
  }

  const { data: ride, error } = await supabase
    .from("rides")
    .insert({
      driver_id: user.id,
      car_id: draft.carId,
      origin_city_id: draft.origin.cityId,
      origin_pickup_id: draft.origin.pickupPointId,
      dest_city_id: draft.destination.cityId,
      dest_pickup_id: draft.destination.pickupPointId,
      departure_at: draft.departureAt,
      seats_total: draft.seatsTotal,
      seats_available: draft.seatsTotal,
      price_per_seat_mkd: draft.pricePerSeatMkd,
      notes: draft.notes,
      details: { submission_id: submissionId },
      tags: draft.tags,
      gender_preference: draft.genderPreference,
      status: intent === "publish" ? "published" : "draft",
      source: draft.source,
      import_id: draft.importId,
    })
    .select("id")
    .single();

  if (error) {
    return {
      status: "error",
      message: databaseMessage(error),
      fieldErrors: {},
    };
  }

  return {
    status: "success",
    message: intent === "publish" ? "Ride published." : "Ride saved as a draft.",
    fieldErrors: {},
    rideId: ride.id,
  };
}
