import { z } from "zod";

export const searchWarningSchema = z.object({
  field: z.enum(["origin", "destination", "departure", "seats"]).nullable(),
  code: z.enum(["ambiguous", "invalid_range", "needs_review", "unsupported"]),
  message: z.string().trim().min(1).max(240),
});

const nullableCanonicalId = z.number().int().positive().nullable();
const nullableInstant = z.iso.datetime({ offset: true }).nullable();

export const searchQueryResultSchema = z
  .object({
    originId: nullableCanonicalId,
    destinationId: nullableCanonicalId,
    departureAfter: nullableInstant,
    departureBefore: nullableInstant,
    // Optional only for compatibility with previously saved search interpretations.
    dateFrom: z.iso.date().nullable().optional(),
    dateTo: z.iso.date().nullable().optional(),
    timeAfter: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    timeBefore: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    requestedSeats: z.number().int().min(1).max(8).nullable(),
    confidence: z.number().min(0).max(1),
    warnings: z.array(searchWarningSchema).max(8),
  })
  .superRefine((result, context) => {
    if (
      result.departureAfter &&
      result.departureBefore &&
      Date.parse(result.departureAfter) >= Date.parse(result.departureBefore)
    ) {
      context.addIssue({
        code: "custom",
        path: ["departureBefore"],
        message: "Departure end must be later than departure start",
      });
    }
  });

export type SearchQueryResult = z.infer<typeof searchQueryResultSchema>;
export type SearchWarning = z.infer<typeof searchWarningSchema>;
