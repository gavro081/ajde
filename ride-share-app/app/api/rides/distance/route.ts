import { z } from "zod";
import { offerApiContext } from "@/lib/rides/offer-api-auth";
import { normalizeLocation } from "@/lib/ai/resolve-location";
import { roadDistanceKm } from "@/lib/rides/road-distance";

const inputSchema = z.object({ originCity: z.string().trim().min(1).max(160), destinationCity: z.string().trim().min(1).max(160) });

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
  const result = await roadDistanceKm(supabase, origin.id, destination.id);
  if (result.ok) return Response.json({ distanceKm: result.distanceKm });
  return Response.json({ error: result.error, ...(result.retryAfterMs === undefined ? {} : { retryAfterMs: result.retryAfterMs }) }, {
    status: result.status,
    headers: result.retryAfterSeconds === undefined ? undefined : { "Retry-After": String(result.retryAfterSeconds) },
  });
}
