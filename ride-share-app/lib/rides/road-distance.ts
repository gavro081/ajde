import "server-only";
import { z } from "zod";

type CityCoordinates = { id: number; lat: number; lng: number };

/** Uses the caller's authenticated client and the application-wide permit RPC. */
export type RoadDistanceClient = {
  from(table: "cities"): {
    select(columns: "id, lat, lng"): PromiseLike<{ data: CityCoordinates[] | null; error: unknown }>;
  };
  rpc(name: "try_ride_routing_request"): PromiseLike<{ data: boolean | null; error: unknown }>;
};

export type RoadDistanceResult =
  | { ok: true; distanceKm: number }
  | { ok: false; error: string; status: 400 | 429 | 502 | 503; retryAfterMs?: number; retryAfterSeconds?: number };

const routeSchema = z.object({ code: z.literal("Ok"), routes: z.array(z.object({ distance: z.number().positive().finite() })).min(1) });

/** Canonical city reference coordinates define the estimate, never pickup points. */
export async function roadDistanceKm(client: RoadDistanceClient, originCityId: number, destinationCityId: number): Promise<RoadDistanceResult> {
  const { data: cities, error } = await client.from("cities").select("id, lat, lng");
  if (error || !cities) return { ok: false, error: "Cities are unavailable. Enter km manually.", status: 503 };
  const origin = cities.find(city => city.id === originCityId);
  const destination = cities.find(city => city.id === destinationCityId);
  if (!origin || !destination || origin.id === destination.id) return { ok: false, error: "Choose two different supported cities.", status: 400 };
  const permit = await client.rpc("try_ride_routing_request");
  if (permit.error) return { ok: false, error: "Routing is unavailable. Enter km manually.", status: 503 };
  if (!permit.data) return { ok: false, error: "Waiting for the routing service.", status: 429, retryAfterMs: 1300, retryAfterSeconds: 2 };
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false&alternatives=false&steps=false`;
    const response = await fetch(url, { headers: { "User-Agent": "StudentRideShare/1.0 (non-commercial ride offer demo)" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Routing failed");
    const result = routeSchema.parse(await response.json());
    return { ok: true, distanceKm: Math.round(result.routes[0].distance / 100) / 10 };
  } catch {
    return { ok: false, error: "Road distance is unavailable. Enter km manually.", status: 502 };
  }
}
