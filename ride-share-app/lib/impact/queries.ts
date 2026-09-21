import "server-only";

import { getCurrentUser } from "../auth/session";
import { calculateRideEstimate } from "../rides/ride-estimate";
import { createClient } from "../supabase/server";

export type ImpactTotal = {
  savedCo2Kg: number;
  eligibleTrips: number;
  includedTrips: number;
  excludedTrips: number;
};

export type ImpactSummary = {
  personal: ImpactTotal;
  platform: ImpactTotal;
  assumptions: readonly string[];
};

const assumptions = [
  "Estimated savings assume each accepted passenger seat replaces a separate car making the same trip with the shared car's consumption. These are estimates, not measured emissions.",
  "Personal savings belong to passengers for their accepted seats. Drivers receive no additional credit for driving; each trip contributes once to the platform total.",
  "Only departed, completed rides with accepted seats qualify. Petrol and diesel are supported; missing cars, invalid distance or consumption, and other fuels are excluded.",
  "Calculations use currently stored trip and car data, not immutable history. Cancelling an accepted booking can reduce these totals.",
] as const;

function emptyTotal(): ImpactTotal {
  return { savedCo2Kg: 0, eligibleTrips: 0, includedTrips: 0, excludedTrips: 0 };
}

/** Private request-time query. Raw platform participation never leaves this module. */
export async function getImpactSummary(): Promise<ImpactSummary> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to view impact estimates.");
  const supabase = await createClient();
  const personal = emptyTotal();
  const platform = emptyTotal();
  const cutoff = new Date().toISOString();
  let rideCursor: string | null = null;
  // Keyset pagination is deterministic and stays bounded even if the server caps
  // responses below our limit. Only an empty page proves traversal is complete.
  for (;;) {
    let rideQuery = supabase.from("rides")
      .select("id, details, car:cars!rides_car_id_fkey(fuel_type, consumption_l_100km)")
      .eq("status", "completed").lt("departure_at", cutoff).order("id").limit(100);
    if (rideCursor) rideQuery = rideQuery.gt("id", rideCursor);
    const { data: rides, error } = await rideQuery;
    if (error || !rides) throw new Error("Unable to load impact estimates.");
    if (!rides.length) break;
    const seatsByRide = new Map(rides.map(ride => [ride.id, { seats: 0, personalSeats: 0 }]));
    let bookingCursor: string | null = null;
    // Bookings are queried independently: embedded one-to-many results can be
    // silently truncated, whereas the embedded car is a single FK snapshot.
    for (;;) {
      let bookingQuery = supabase.from("bookings")
        .select("id, ride_id, passenger_id, seats").in("ride_id", rides.map(ride => ride.id))
        .eq("status", "accepted").order("id").limit(200);
      if (bookingCursor) bookingQuery = bookingQuery.gt("id", bookingCursor);
      const { data: bookings, error: bookingError } = await bookingQuery;
      if (bookingError || !bookings) throw new Error("Unable to load impact estimates.");
      if (!bookings.length) break;
      for (const booking of bookings) {
        const totals = seatsByRide.get(booking.ride_id)!;
        totals.seats += booking.seats;
        if (booking.passenger_id === user.id) totals.personalSeats += booking.seats;
      }
      bookingCursor = bookings[bookings.length - 1].id;
    }
    for (const ride of rides) {
      const { seats, personalSeats } = seatsByRide.get(ride.id)!;
      if (!seats) continue;
      const details = ride.details;
      const distance = details && typeof details === "object" && !Array.isArray(details) ? details.distance_km : null;
      const car = ride.car;
      platform.eligibleTrips++;
      if (personalSeats) personal.eligibleTrips++;
      if (typeof distance !== "number" || !Number.isFinite(distance) || distance <= 0 ||
          !car || !Number.isFinite(car.consumption_l_100km) || car.consumption_l_100km <= 0 ||
          (car.fuel_type !== "petrol" && car.fuel_type !== "diesel")) {
        platform.excludedTrips++;
        if (personalSeats) personal.excludedTrips++;
        continue;
      }
      const tripCo2Kg = calculateRideEstimate({
        distanceKm: distance, consumptionL100Km: car.consumption_l_100km,
        fuelType: car.fuel_type,
        // Emissions are price-independent. Satisfy the calculator's cost inputs,
        // then discard all cost outputs; no fuel-price configuration is needed.
        fuelPriceMkdL: 1, seats: 1,
      }).tripCo2Kg;
      if (!Number.isFinite((platform.savedCo2Kg + tripCo2Kg * seats) * 100)) {
        platform.excludedTrips++;
        if (personalSeats) personal.excludedTrips++;
        continue;
      }
      platform.includedTrips++;
      platform.savedCo2Kg += tripCo2Kg * seats;
      if (personalSeats) {
        personal.includedTrips++;
        personal.savedCo2Kg += tripCo2Kg * personalSeats;
      }
    }
    rideCursor = rides[rides.length - 1].id;
  }
  personal.savedCo2Kg = Math.round(personal.savedCo2Kg * 100) / 100;
  platform.savedCo2Kg = Math.round(platform.savedCo2Kg * 100) / 100;
  return { personal, platform, assumptions };
}
