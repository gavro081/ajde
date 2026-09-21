import { z } from "zod";

import { searchQueryResultSchema } from "./search-query-schema";

export const MAX_EXPLAINED_RIDES = 24;

export const explainRequestSchema = z.object({
  rideIds: z.array(z.uuid()).max(MAX_EXPLAINED_RIDES),
  context: searchQueryResultSchema,
});

export const matchExplanationSchema = z.object({
  rideId: z.uuid(),
  explanation: z.string().trim().min(8).max(180),
});

export const matchExplanationResponseSchema = z.object({
  explanations: z.array(matchExplanationSchema).max(MAX_EXPLAINED_RIDES),
});

export function shouldApplyExplanationResponse(requestKey: string, currentKey: string) {
  return requestKey === currentKey;
}
