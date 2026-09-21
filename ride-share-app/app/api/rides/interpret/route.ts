import { offerApiContext } from "@/lib/rides/offer-api-auth";
import { parseOfferDescription, OfferDescriptionError } from "@/lib/ai/parse-offer-description";
import { offerRequestSchema } from "@/lib/rides/offer-interpretation";

export async function POST(request: Request) {
  const context = await offerApiContext();
  if (context instanceof Response) return context;
  const { supabase, user } = context;
  const input = offerRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Describe your trips in 2–6000 characters." }, { status: 400 });
  const [cities, pickups, cars, models] = await Promise.all([
    supabase.from("cities").select("id, name_en, name_mk, aliases"),
    supabase.from("pickup_points").select("id, city_id, name_en, name_mk, aliases"),
    supabase.from("cars").select("id, make, model, fuel_type, consumption_l_100km, seats_total").eq("owner_id", user.id),
    supabase.from("car_models").select("id, make, model, fuel_type, consumption_l_100km"),
  ]);
  if (cities.error || pickups.error || cars.error || models.error) return Response.json({ error: "Catalogs could not be loaded. Retry or enter details manually." }, { status: 503 });
  try {
    return Response.json(await parseOfferDescription(input.data, { cities: cities.data, pickupPoints: pickups.data, cars: cars.data, carModels: models.data }));
  } catch (error) {
    return Response.json({ error: error instanceof OfferDescriptionError ? error.message : "Interpretation failed. Retry or enter details manually." }, { status: 422 });
  }
}
