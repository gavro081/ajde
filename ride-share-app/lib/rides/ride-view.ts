import "server-only";

import type { Tables } from "@/lib/supabase/database.types";
import {
  departureBoundsForFilters,
  type RideFilters,
} from "@/lib/rides/ride-filters";
import { createClient } from "@/lib/supabase/server";

export type RideView = Tables<"rides"> & {
  originCity: Pick<Tables<"cities">, "id" | "name_en" | "name_mk">;
  destinationCity: Pick<Tables<"cities">, "id" | "name_en" | "name_mk">;
  originPickup: Pick<Tables<"pickup_points">, "id" | "name_en" | "name_mk"> | null;
  destinationPickup: Pick<Tables<"pickup_points">, "id" | "name_en" | "name_mk"> | null;
  driver: Pick<Tables<"profiles">, "id" | "full_name" | "photo_url" | "university" | "verified_at"> | null;
  car: Pick<Tables<"cars">, "id" | "make" | "model" | "color"> | null;
};

export async function getRideFeed(
  filters: RideFilters,
  { now = new Date() }: { now?: Date } = {},
): Promise<RideView[]> {
  const supabase = await createClient();
  const bounds = departureBoundsForFilters(filters, now);
  let query = supabase
    .from("rides")
    .select("*")
    .in("status", ["published", "full"])
    .gte("departure_at", bounds.after)
    .gte("seats_available", filters.seats)
    .order("departure_at")
    .limit(100);

  if (filters.origin) query = query.eq("origin_city_id", filters.origin);
  if (filters.destination) query = query.eq("dest_city_id", filters.destination);
  if (bounds.before) query = query.lt("departure_at", bounds.before);

  const { data, error } = await query;
  if (error) throw new Error("Unable to load rides.");
  return hydrateRides(data);
}

export async function getRide(rideId: string): Promise<RideView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("rides").select("*").eq("id", rideId).maybeSingle();
  if (error) throw new Error("Unable to load this ride.");
  if (!data) return null;
  return (await hydrateRides([data]))[0] ?? null;
}

async function hydrateRides(rides: Tables<"rides">[]): Promise<RideView[]> {
  if (rides.length === 0) return [];
  const supabase = await createClient();
  const cityIds = [...new Set(rides.flatMap((ride) => [ride.origin_city_id, ride.dest_city_id]))];
  const pickupIds = [...new Set(rides.flatMap((ride) => [ride.origin_pickup_id, ride.dest_pickup_id]).filter((id): id is number => id !== null))];
  const driverIds = [...new Set(rides.map((ride) => ride.driver_id).filter((id): id is string => id !== null))];
  const carIds = [...new Set(rides.map((ride) => ride.car_id).filter((id): id is string => id !== null))];

  const [citiesResult, pickupsResult, profilesResult, carsResult] = await Promise.all([
    supabase.from("cities").select("id, name_en, name_mk").in("id", cityIds),
    pickupIds.length
      ? supabase.from("pickup_points").select("id, name_en, name_mk").in("id", pickupIds)
      : Promise.resolve({ data: [], error: null }),
    driverIds.length
      ? supabase.from("profiles").select("id, full_name, photo_url, university, verified_at").in("id", driverIds)
      : Promise.resolve({ data: [], error: null }),
    carIds.length
      ? supabase.from("cars").select("id, make, model, color").in("id", carIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (citiesResult.error || pickupsResult.error || profilesResult.error || carsResult.error) {
    throw new Error("Unable to load ride details.");
  }

  const cities = new Map((citiesResult.data ?? []).map((row) => [row.id, row]));
  const pickups = new Map((pickupsResult.data ?? []).map((row) => [row.id, row]));
  const profiles = new Map((profilesResult.data ?? []).map((row) => [row.id, row]));
  const cars = new Map((carsResult.data ?? []).map((row) => [row.id, row]));

  return rides.flatMap((ride) => {
    const originCity = cities.get(ride.origin_city_id);
    const destinationCity = cities.get(ride.dest_city_id);
    if (!originCity || !destinationCity) return [];
    return [{
      ...ride,
      originCity,
      destinationCity,
      originPickup: ride.origin_pickup_id ? pickups.get(ride.origin_pickup_id) ?? null : null,
      destinationPickup: ride.dest_pickup_id ? pickups.get(ride.dest_pickup_id) ?? null : null,
      driver: ride.driver_id ? profiles.get(ride.driver_id) ?? null : null,
      car: ride.car_id ? cars.get(ride.car_id) ?? null : null,
    }];
  });
}

export function formatDeparture(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Skopje",
  }).format(new Date(value));
}
