"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { readCarSelection } from "@/lib/rides/car-selection";
import { createClient } from "@/lib/supabase/server";
import { issuesByPath, validateRideSubmission } from "@/lib/rides/ride-form";


export type CreateRideFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors: Record<string, string[]>;
  rideId?: string;
  carId?: string;
};

const NEW_CAR_VALIDATION_ID = "00000000-0000-4000-8000-000000000000";

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

  const result = await supabase.rpc("create_ride_offer", {
    p_offer: validation.draft.data,
    p_vehicle: carSelection.data,
    p_submission_id: validation.metadata.data.submissionId,
    p_publish: validation.metadata.data.intent === "publish",
  });
  if (result.error) {
    return { status: "error", fieldErrors: {}, message:
      result.error.code === "42501" ? "Your car or imported draft is unavailable for this account. Review the form."
      : result.error.code === "23514" ? "Review the departure, available seats and vehicle details."
      : result.error.code === "23503" ? "A selected city, pickup point or car is no longer available."
      : "We could not save this ride. Retry; the same draft will not create a duplicate." };
  }
  const saved = z.object({ rideId: z.uuid(), carId: z.uuid(), status: z.enum(["draft", "published", "full", "completed", "cancelled"]) }).safeParse(result.data);
  if (!saved.success) return { status: "error", fieldErrors: {}, message: "The publication result could not be confirmed. Retry this draft." };
  revalidatePath("/rides");
  revalidatePath("/dashboard/driver");
  return { status: "success", fieldErrors: {}, rideId: saved.data.rideId, carId: saved.data.carId,
    message: saved.data.status === "draft" ? "Ride saved as a draft." : "Ride published." };
}
