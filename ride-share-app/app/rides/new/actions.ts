"use server";

import type { PostgrestError } from "@supabase/supabase-js";

import { anonymousRideTestingEnabled } from "@/lib/rides/anonymous-test-mode";
import { readCarSelection, type CarSelection } from "@/lib/rides/car-selection";
import { createClient } from "@/lib/supabase/server";
import { issuesByPath, validateRideSubmission } from "@/lib/rides/ride-form";
import type { TablesInsert } from "@/lib/supabase/database.types";

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

const NEW_CAR_VALIDATION_ID = "00000000-0000-4000-8000-000000000000";

async function resolveCar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  selection: CarSelection,
) {
  if (selection.mode === "existing") {
    const { data, error } = await supabase
      .from("cars")
      .select("id, seats_total")
      .eq("id", selection.carId)
      .eq("owner_id", userId)
      .maybeSingle();

    return {
      carId: data?.id ?? null,
      seatsTotal: data?.seats_total ?? null,
      created: false,
      error,
    };
  }

  let car: TablesInsert<"cars">;

  if (selection.mode === "catalog") {
    const { data: model, error } = await supabase
      .from("car_models")
      .select("id, make, model, fuel_type")
      .eq("id", selection.carModelId)
      .maybeSingle();

    if (error || !model) {
      return { carId: null, seatsTotal: null, created: false, error };
    }

    car = {
      owner_id: userId,
      car_model_id: model.id,
      make: model.make,
      model: model.model,
      fuel_type: model.fuel_type,
      consumption_l_100km: selection.consumptionL100Km,
      color: selection.color,
      plate_last3: selection.plateLast3,
      seats_total: selection.seatsTotal,
    };
  } else {
    car = {
      owner_id: userId,
      car_model_id: null,
      make: selection.make,
      model: selection.model,
      fuel_type: selection.fuelType,
      consumption_l_100km: selection.consumptionL100Km,
      color: selection.color,
      plate_last3: selection.plateLast3,
      seats_total: selection.seatsTotal,
    };
  }

  const { data, error } = await supabase.from("cars").insert(car).select("id").single();
  return {
    carId: data?.id ?? null,
    seatsTotal: selection.seatsTotal,
    created: Boolean(data),
    error,
  };
}

export async function createRide(
  _previousState: CreateRideFormState,
  formData: FormData,
): Promise<CreateRideFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !anonymousRideTestingEnabled()) {
    return {
      status: "error",
      message: "Your session has expired. Sign in and try again.",
      fieldErrors: {},
    };
  }

  const carSelection = readCarSelection(formData);
  const validationCarId = carSelection.success
    ? carSelection.data.mode === "existing"
      ? carSelection.data.carId
      : NEW_CAR_VALIDATION_ID
    : undefined;
  const validation = validateRideSubmission(formData, new Date(), validationCarId);
  const issues = [
    ...(validation.draft.success ? [] : validation.draft.error.issues),
    ...(validation.metadata.success ? [] : validation.metadata.error.issues),
    ...(carSelection.success ? [] : carSelection.error.issues),
  ];

  if (!validation.draft.success || !validation.metadata.success || !carSelection.success) {
    return {
      status: "error",
      message: "Review the highlighted ride details.",
      fieldErrors: issuesByPath(issues),
    };
  }

  const draft = validation.draft.data;
  const { intent, submissionId } = validation.metadata.data;

  if (!user) {
    const carCapacity =
      carSelection.data.mode === "existing" ? null : carSelection.data.seatsTotal;
    if (carCapacity !== null && draft.seatsTotal > carCapacity) {
      return {
        status: "error",
        message: "The ride offers more seats than the selected car has.",
        fieldErrors: { seatsTotal: ["Reduce the available seats or choose a larger car."] },
      };
    }

    return {
      status: "success",
      message: `Anonymous test passed for ${intent === "publish" ? "publishing" : "saving"}. Nothing was saved.`,
      fieldErrors: {},
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

  if (draft.source === "imported") {
    if (!draft.importId) {
      return {
        status: "error",
        message: "This imported draft is incomplete. Parse the post again.",
        fieldErrors: { importId: ["The import reference is missing."] },
      };
    }

    const { data: ownedImport, error: importError } = await supabase
      .from("imports")
      .select("id")
      .eq("id", draft.importId)
      .eq("created_by", user.id)
      .maybeSingle();

    if (importError || !ownedImport) {
      return {
        status: "error",
        message: "This imported draft is unavailable. Parse the post again.",
        fieldErrors: { importId: ["The import does not belong to your account."] },
      };
    }
  }

  const resolvedCar = await resolveCar(supabase, user.id, carSelection.data);
  if (resolvedCar.error || !resolvedCar.carId) {
    return {
      status: "error",
      message:
        carSelection.data.mode === "existing"
          ? "Choose one of your saved cars."
          : "We could not save this car. Review its details and try again.",
      fieldErrors: {
        carId:
          carSelection.data.mode === "existing"
            ? ["The selected car does not belong to your account."]
            : ["The new car could not be saved."],
      },
    };
  }

  if (resolvedCar.seatsTotal !== null && draft.seatsTotal > resolvedCar.seatsTotal) {
    if (resolvedCar.created) {
      await supabase
        .from("cars")
        .delete()
        .eq("id", resolvedCar.carId)
        .eq("owner_id", user.id);
    }

    return {
      status: "error",
      message: "The ride offers more seats than the selected car has.",
      fieldErrors: { seatsTotal: ["Reduce the available seats or choose a larger car."] },
    };
  }

  const { data: ride, error } = await supabase
    .from("rides")
    .insert({
      driver_id: user.id,
      car_id: resolvedCar.carId,
      origin_city_id: draft.origin.cityId,
      origin_pickup_id: draft.origin.pickupPointId,
      dest_city_id: draft.destination.cityId,
      dest_pickup_id: draft.destination.pickupPointId,
      departure_at: draft.departureAt,
      seats_total: draft.seatsTotal,
      seats_available: draft.seatsTotal,
      price_per_seat_mkd: draft.pricePerSeatMkd,
      notes: draft.notes,
      details: { distance_km: draft.distanceKm, submission_id: submissionId },
      tags: draft.tags,
      gender_preference: draft.genderPreference,
      status: intent === "publish" ? "published" : "draft",
      source: draft.source,
      import_id: draft.importId,
    })
    .select("id")
    .single();

  if (error) {
    if (resolvedCar.created) {
      await supabase
        .from("cars")
        .delete()
        .eq("id", resolvedCar.carId)
        .eq("owner_id", user.id);
    }

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
