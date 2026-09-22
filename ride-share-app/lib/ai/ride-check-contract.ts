import { z } from "zod";

export const roadDistanceArgsSchema = z.object({
  originCityId: z.number().int().positive(),
  destinationCityId: z.number().int().positive(),
}).strict();
export type RoadDistanceArgs = z.infer<typeof roadDistanceArgsSchema>;

export const roadDistanceResultSchema = z.object({ distanceKm: z.number().finite().positive() });
export const checkToolErrorSchema = z.object({ error: z.string().min(1).max(300) });
export const checkTraceEntrySchema = z.object({
  callId: z.string().min(1),
  tool: z.string(),
  args: roadDistanceArgsSchema.nullable(),
  result: z.union([roadDistanceResultSchema, checkToolErrorSchema]),
});
export type CheckTraceEntry = z.infer<typeof checkTraceEntrySchema>;
export const rideCheckMetadataSchema = z.object({
  status: z.enum(["checked", "unavailable"]),
  trace: z.array(checkTraceEntrySchema),
});
export type RideCheckMetadata = z.infer<typeof rideCheckMetadataSchema>;
