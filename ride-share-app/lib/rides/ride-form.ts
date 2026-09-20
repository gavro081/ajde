import { z } from "zod";

import { createPublishableRideDraftSchema } from "./ride-draft";

export const rideSubmissionIntentSchema = z.enum(["save_draft", "publish"]);

const submissionIdSchema = z.uuid();

function nullableString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function nullableNumber(value: FormDataEntryValue | null) {
  const normalized = nullableString(value);
  if (normalized === null) return null;
  return Number(normalized);
}

export function readRideDraftFromFormData(formData: FormData) {
  return {
    source: formData.get("source"),
    importId: nullableString(formData.get("importId")),
    origin: {
      cityId: nullableNumber(formData.get("originCityId")),
      pickupPointId: nullableNumber(formData.get("originPickupPointId")),
      rawText: null,
    },
    destination: {
      cityId: nullableNumber(formData.get("destinationCityId")),
      pickupPointId: nullableNumber(formData.get("destinationPickupPointId")),
      rawText: null,
    },
    departureAt: nullableString(formData.get("departureAt")),
    seatsTotal: nullableNumber(formData.get("seatsTotal")),
    carId: nullableString(formData.get("carId")),
    car: null,
    pricePerSeatMkd: nullableNumber(formData.get("pricePerSeatMkd")),
    notes: nullableString(formData.get("notes")),
    tags: formData.getAll("tags"),
    genderPreference: nullableString(formData.get("genderPreference")),
    confidence: null,
    fieldConfidence: [],
    warnings: [],
  };
}

export function validateRideSubmission(formData: FormData, now = new Date()) {
  const metadata = z
    .object({
      intent: rideSubmissionIntentSchema,
      submissionId: submissionIdSchema,
    })
    .safeParse({
      intent: formData.get("intent"),
      submissionId: formData.get("submissionId"),
    });

  const draft = createPublishableRideDraftSchema({ now }).safeParse(
    readRideDraftFromFormData(formData),
  );

  return { draft, metadata };
}

export function issuesByPath(issues: z.core.$ZodIssue[]) {
  const errors: Record<string, string[]> = {};

  for (const issue of issues) {
    const path = issue.path.join(".") || "form";
    errors[path] ??= [];
    errors[path].push(issue.message);
  }

  return errors;
}
