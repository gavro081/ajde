import { z } from "zod";
import { latestDeparture, RIDE_LIMITS } from "./ride-limits";

export const RIDE_TAGS = [
  "flexible_pickup",
  "luggage_space",
  "music",
  "no_smoking",
  "pets_allowed",
  "quiet_ride",
] as const;

export const RIDE_DRAFT_FIELDS = [
  "origin",
  "destination",
  "departureAt",
  "distanceKm",
  "seatsTotal",
  "car",
  "pricePerSeatMkd",
  "notes",
  "tags",
  "genderPreference",
] as const;

const nullableIdSchema = z.number().int().positive().nullable();
const nullableTextSchema = z.string().trim().min(1).nullable();

export const rideDraftFieldSchema = z.enum(RIDE_DRAFT_FIELDS);

export const rideDraftWarningSchema = z.object({
  field: rideDraftFieldSchema.nullable(),
  code: z.enum([
    "ambiguous",
    "low_confidence",
    "missing",
    "needs_review",
    "unsupported",
  ]),
  message: z.string().trim().min(1).max(300),
});

export const rideDraftLocationSchema = z.object({
  cityId: nullableIdSchema,
  pickupPointId: nullableIdSchema,
  rawText: z.string().trim().min(1).nullable(),
});

export const rideDraftCarSchema = z.object({
  carModelId: nullableIdSchema,
  make: nullableTextSchema,
  model: nullableTextSchema,
  fuelType: z
    .enum(["petrol", "diesel", "hybrid", "electric", "lpg", "other"])
    .nullable(),
  consumptionL100Km: z.number().positive().nullable(),
  color: nullableTextSchema,
  plateLast3: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{3}$/, "Plate suffix must contain exactly 3 letters or digits")
    .nullable(),
  seatsTotal: z.number().int().min(1).max(8).nullable(),
});

/**
 * Lossless contract for a manually-entered or imported ride draft.
 *
 * Business fields are deliberately nullable: an imported post may omit or
 * ambiguously describe any of them. Use createPublishableRideDraftSchema at
 * the form/server boundary before attempting to publish the ride.
 */
export const rideDraftSchema = z.object({
  source: z.enum(["native", "imported"]),
  importId: z.uuid().nullable(),
  origin: rideDraftLocationSchema,
  destination: rideDraftLocationSchema,
  departureAt: z.iso.datetime({ offset: true }).nullable(),
  distanceKm: z.number().positive().nullable(),
  seatsTotal: z.number().int().min(1).max(8).nullable(),
  carId: z.uuid().nullable(),
  car: rideDraftCarSchema.nullable(),
  pricePerSeatMkd: z.number().int().nonnegative().nullable(),
  notes: z.string().trim().max(2_000).nullable(),
  tags: z.array(z.enum(RIDE_TAGS)),
  genderPreference: z.enum(["any", "same_as_driver"]).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  fieldConfidence: z.array(
    z.object({
      field: rideDraftFieldSchema,
      confidence: z.number().min(0).max(1),
    }),
  ),
  warnings: z.array(rideDraftWarningSchema),
});

export type RideDraft = z.infer<typeof rideDraftSchema>;
export type RideDraftField = z.infer<typeof rideDraftFieldSchema>;
export type RideDraftWarning = z.infer<typeof rideDraftWarningSchema>;

export const importedRideDraftSchema = rideDraftSchema.extend({
  source: z.literal("imported"),
});

export type ImportedRideDraft = z.infer<typeof importedRideDraftSchema>;

const publishableRideDraftBaseSchema = rideDraftSchema.extend({
  origin: rideDraftLocationSchema.extend({ cityId: z.number().int().positive() }),
  destination: rideDraftLocationSchema.extend({ cityId: z.number().int().positive() }),
  departureAt: z.iso.datetime({ offset: true }),
  seatsTotal: z.number().int().min(RIDE_LIMITS.seats.min).max(RIDE_LIMITS.seats.max),
  carId: z.uuid(),
  pricePerSeatMkd: z.number().int().min(RIDE_LIMITS.priceMkd.min).max(RIDE_LIMITS.priceMkd.max, "Price per seat must be between 0 and 3,000 MKD"),
  distanceKm: z.number().min(RIDE_LIMITS.distanceKm.min, "Distance must be at least 1 km").max(RIDE_LIMITS.distanceKm.max, "Distance must be no more than 600 km").nullable(),
  genderPreference: z.enum(["any", "same_as_driver"]),
});

type PublishableSchemaOptions = {
  now?: Date;
};

/**
 * Adds publish-time completeness and cross-field checks to the shared draft.
 * Create the schema at validation time so the future-date check uses a fresh
 * clock on both the client and the server.
 */
export function createPublishableRideDraftSchema({
  now = new Date(),
}: PublishableSchemaOptions = {}) {
  return publishableRideDraftBaseSchema.superRefine((draft, context) => {
    if (draft.origin.cityId === draft.destination.cityId) {
      context.addIssue({
        code: "custom",
        message: "Origin and destination must be different cities",
        path: ["destination", "cityId"],
      });
    }

    if (new Date(draft.departureAt).getTime() <= now.getTime()) {
      context.addIssue({
        code: "custom",
        message: "Departure time must be in the future",
        path: ["departureAt"],
      });
    }

    if (new Date(draft.departureAt).getTime() > latestDeparture(now).getTime()) {
      context.addIssue({ code: "custom", message: "Departure must be within the next 90 days", path: ["departureAt"] });
    }

    if (draft.source === "native" && draft.importId !== null) {
      context.addIssue({
        code: "custom",
        message: "A native ride cannot reference an import",
        path: ["importId"],
      });
    }

    if (draft.source === "imported" && draft.importId === null) {
      context.addIssue({
        code: "custom",
        message: "An imported ride must reference its import",
        path: ["importId"],
      });
    }
  });
}

export type PublishableRideDraft = z.infer<
  ReturnType<typeof createPublishableRideDraftSchema>
>;
