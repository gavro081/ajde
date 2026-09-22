import { z } from "zod";

export const roadDistanceArgsSchema = z.object({
  originCityId: z.number().int().positive(),
  destinationCityId: z.number().int().positive(),
}).strict();
export type RoadDistanceArgs = z.infer<typeof roadDistanceArgsSchema>;

export const findSimilarRidesArgsSchema = roadDistanceArgsSchema.extend({
  departureAt: z.iso.datetime({ offset: true }),
}).strict();
export type FindSimilarRidesArgs = z.infer<typeof findSimilarRidesArgsSchema>;
export const findSimilarRidesResultSchema = z.object({ rides: z.array(z.object({
  id: z.uuid(),
  departureAt: z.iso.datetime({ offset: true }),
  pricePerSeatMkd: z.number().finite().nonnegative().nullable(),
  seatsAvailable: z.number().int().min(0).max(8),
})).max(5) });
export type FindSimilarRidesResult = z.infer<typeof findSimilarRidesResultSchema>;
export const fairPriceArgsSchema = z.object({
  distanceKm: z.number().finite().positive(),
  availableSeats: z.number().int().min(1).max(8),
  fuelType: z.enum(["petrol", "diesel"]).nullable(),
  consumptionL100Km: z.number().finite().positive().nullable(),
}).strict();
export type FairPriceArgs = z.infer<typeof fairPriceArgsSchema>;
export const fairPriceResultSchema = z.object({
  pricePerSeatMkd: z.number().int().positive(),
  totalTripCostMkd: z.number().finite().positive(),
  assumptions: z.object({
    distanceKm: z.number().finite().positive(), availableSeats: z.number().int().min(1).max(8),
    fuelType: z.enum(["petrol", "diesel"]), consumptionL100Km: z.number().finite().positive(),
    fuelPriceMkdL: z.number().finite().positive(), defaultFuelType: z.boolean(), defaultConsumption: z.boolean(),
    tollsMkd: z.literal(0),
  }),
});
export type FairPriceResult = z.infer<typeof fairPriceResultSchema>;

export const roadDistanceResultSchema = z.object({ distanceKm: z.number().finite().positive() });
export const checkToolErrorSchema = z.object({ error: z.string().min(1).max(300) });
export const checkTraceEntrySchema = z.object({
  callId: z.string().min(1),
  tool: z.string(),
  args: z.union([roadDistanceArgsSchema, fairPriceArgsSchema, findSimilarRidesArgsSchema]).nullable(),
  result: z.union([checkToolErrorSchema, roadDistanceResultSchema, fairPriceResultSchema, findSimilarRidesResultSchema]),
});
export type CheckTraceEntry = z.infer<typeof checkTraceEntrySchema>;
export const rideCheckMetadataSchema = z.object({
  status: z.enum(["checked", "unavailable"]),
  trace: z.array(checkTraceEntrySchema),
});
export type RideCheckMetadata = z.infer<typeof rideCheckMetadataSchema>;
