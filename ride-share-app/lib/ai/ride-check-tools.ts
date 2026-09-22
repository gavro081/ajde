import "server-only";

import type { ToolExecutors } from "./check-ride-draft";
import { roadDistanceKm } from "@/lib/rides/road-distance";
import type { createClient } from "@/lib/supabase/server";
import { findSimilarRides } from "./similar-rides-tool";

/** Reuse the signed-in caller's database access and the shared routing permit. */
export function createRideCheckTools(supabase: Awaited<ReturnType<typeof createClient>>): ToolExecutors {
  return {
    find_similar_rides: args => findSimilarRides(supabase, args),
    road_distance: async ({ originCityId, destinationCityId }) => {
      const result = await roadDistanceKm(supabase, originCityId, destinationCityId);
      return result.ok ? { distanceKm: result.distanceKm } : { error: result.error };
    },
  };
}
