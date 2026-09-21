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

export function explanationRideMatchesContext(
  ride: {
    origin_city_id: number;
    dest_city_id: number;
    departure_at: string;
    seats_available: number;
  },
  context: {
    originId: number | null;
    destinationId: number | null;
    departureAfter: string | null;
    departureBefore: string | null;
    requestedSeats: number | null;
  },
) {
  if (context.originId !== null && ride.origin_city_id !== context.originId) return false;
  if (context.destinationId !== null && ride.dest_city_id !== context.destinationId) return false;
  if (context.departureAfter !== null && ride.departure_at < context.departureAfter) return false;
  if (context.departureBefore !== null && ride.departure_at >= context.departureBefore) return false;
  if (context.requestedSeats !== null && ride.seats_available < context.requestedSeats) return false;
  return true;
}
