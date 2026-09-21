import {
  explainMatch,
  type ExplainRideFact,
} from "@/lib/ai/explain-match";
import { explainRequestSchema } from "@/lib/ai/explain-match-schema";
import { isAllowedStudentEmail } from "@/lib/auth/email-domain";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in before requesting explanations." }, { status: 401 });
  if (!user.email || !isAllowedStudentEmail(user.email)) {
    return Response.json({ error: "Use an approved student account." }, { status: 403 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, photo_url, university")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return Response.json({ error: "Profile access could not be verified." }, { status: 500 });
  if (!profile?.full_name.trim() || !profile.photo_url.trim() || !profile.university.trim()) {
    return Response.json({ error: "Complete onboarding before requesting explanations." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON request." }, { status: 400 });
  }
  const input = explainRequestSchema.safeParse(body);
  if (!input.success) return Response.json({ error: "Explanation request is invalid." }, { status: 400 });
  if (input.data.rideIds.length === 0) return Response.json({ explanations: [] });

  const { data: rides, error: rideError } = await supabase
    .from("rides")
    .select("id, origin_city_id, dest_city_id, departure_at, seats_available, price_per_seat_mkd, status")
    .in("id", input.data.rideIds)
    .in("status", ["published", "full"])
    .gte("departure_at", new Date().toISOString());
  if (rideError) return Response.json({ error: "Ride facts could not be loaded." }, { status: 500 });

  const eligible = rides.filter((ride) => matchesContext(ride, input.data.context));
  const cityIds = [...new Set(eligible.flatMap((ride) => [ride.origin_city_id, ride.dest_city_id]))];
  const { data: cities, error: cityError } = cityIds.length
    ? await supabase.from("cities").select("id, name_en").in("id", cityIds)
    : { data: [], error: null };
  if (cityError) return Response.json({ error: "Route facts could not be loaded." }, { status: 500 });

  const cityNames = new Map((cities ?? []).map((city) => [city.id, city.name_en]));
  const byId = new Map(eligible.map((ride) => [ride.id, ride]));
  const facts: ExplainRideFact[] = input.data.rideIds.flatMap((rideId) => {
    const ride = byId.get(rideId);
    if (!ride) return [];
    const originName = cityNames.get(ride.origin_city_id);
    const destinationName = cityNames.get(ride.dest_city_id);
    if (!originName || !destinationName) return [];
    return [{
      rideId: ride.id,
      originCityId: ride.origin_city_id,
      originName,
      destinationCityId: ride.dest_city_id,
      destinationName,
      departureAt: ride.departure_at,
      seatsAvailable: ride.seats_available,
      pricePerSeatMkd: ride.price_per_seat_mkd,
    }];
  });

  return Response.json({ explanations: await explainMatch(facts, input.data.context) });
}

function matchesContext(
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
