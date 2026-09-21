import { z } from "zod";
import { rideDraftSchema, type RideDraft } from "./ride-draft";
import { offerValuesSchema } from "./offer-values";

export const offerMentionSchema = z.enum(["origin", "destination", "departureDate", "departureTime", "car", "seatsTotal", "pricePerSeatMkd", "notes", "tags", "genderPreference"]);
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
export const localTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const offerTripSchema = z.object({ draft: rideDraftSchema, mentioned: z.array(offerMentionSchema), dateLocal: localDateSchema.nullable(), timeLocal: localTimeSchema.nullable() });
export const offerInterpretationSchema = z.object({ trips: z.array(offerTripSchema).min(1) });
export type OfferTrip = z.infer<typeof offerTripSchema>;
export const offerRequestSchema = z.object({ text: z.string().trim().min(2).max(6000), mode: z.enum(["create", "correct"]), current: offerValuesSchema.optional() });
export type OfferRequest = z.infer<typeof offerRequestSchema>;
export function emptyOfferDraft(): RideDraft {
  return { source: "native", importId: null, origin: { cityId: null, pickupPointId: null, rawText: null },
    destination: { cityId: null, pickupPointId: null, rawText: null }, departureAt: null, distanceKm: null,
    seatsTotal: null, carId: null, car: null, pricePerSeatMkd: null, notes: null, tags: [], genderPreference: "any",
    confidence: null, fieldConfidence: [], warnings: [] };
}
