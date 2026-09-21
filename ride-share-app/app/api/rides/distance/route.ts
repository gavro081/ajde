import { z } from "zod";
import { offerApiContext } from "@/lib/rides/offer-api-auth";
import { normalizeLocation } from "@/lib/ai/resolve-location";

const inputSchema = z.object({ originCity: z.string().trim().min(1).max(160), destinationCity: z.string().trim().min(1).max(160) });
const routeSchema = z.object({ code: z.literal("Ok"), routes: z.array(z.object({ distance: z.number().positive().finite() })).min(1) });

export async function POST(request: Request) {
  const context = await offerApiContext();
  if (context instanceof Response) return context;
  const { supabase } = context;
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Select both city names first." }, { status: 400 });
  const { data: cities, error } = await supabase.from("cities").select("id, name_en, name_mk, lat, lng");
  if (error || !cities) return Response.json({ error: "Cities are unavailable. Enter km manually." }, { status: 503 });
  const find = (name: string) => cities.find(city => [city.name_en, city.name_mk].some(value => normalizeLocation(value) === normalizeLocation(name)));
  const origin = find(input.data.originCity), destination = find(input.data.destinationCity);
  if (!origin || !destination || origin.id === destination.id) return Response.json({ error: "Choose two different supported cities." }, { status: 400 });
  const permit = await supabase.rpc("try_ride_routing_request");
  if (permit.error) return Response.json({ error: "Routing is unavailable. Enter km manually." }, { status: 503 });
  if (!permit.data) return Response.json({ error: "Waiting for the routing service.", retryAfterMs: 1300 }, { status: 429, headers: { "Retry-After": "2" } });
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false&alternatives=false&steps=false`;
    const response = await fetch(url, { headers: { "User-Agent": "StudentRideShare/1.0 (non-commercial ride offer demo)" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Routing failed");
    const result = routeSchema.parse(await response.json());
    return Response.json({ distanceKm: Math.round(result.routes[0].distance / 100) / 10 });
  } catch {
    return Response.json({ error: "Road distance is unavailable. Enter km manually." }, { status: 502 });
  }
}
