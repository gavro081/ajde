import { z } from "zod";

export const ratingInputSchema = z.object({
  rideId: z.uuid(),
  rateeId: z.uuid(),
  score: z.number().int().min(1).max(5),
  note: z.string().trim().max(1000).nullish().transform((note) => note || null),
});
