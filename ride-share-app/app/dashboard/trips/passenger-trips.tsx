import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";
import { TripShareControls } from "@/components/trip-share-controls";
import { RatingControl } from "@/components/ratings/rating-control";
import { getRatingControls } from "@/lib/ratings/queries";
import { formatDeparture } from "@/lib/rides/ride-view";
import { createClient } from "@/lib/supabase/server";

import { cancelBooking } from "../actions";

export async function PassengerTrips({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: bookings, error } = await supabase.from("bookings").select("id, ride_id, seats, message, status, created_at").eq("passenger_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load your trips.");
  const rideIds = [...new Set((bookings ?? []).map((booking) => booking.ride_id))];
  const { data: rides } = rideIds.length ? await supabase.from("rides").select("id, driver_id, departure_at, origin_city_id, dest_city_id, price_per_seat_mkd, status").in("id", rideIds) : { data: [] };
  const cityIds = [...new Set((rides ?? []).flatMap((ride) => [ride.origin_city_id, ride.dest_city_id]))];
  const acceptedDriverIds = [...new Set((bookings ?? []).filter((booking) => booking.status === "accepted").flatMap((booking) => {
    const ride = rides?.find((entry) => entry.id === booking.ride_id);
    return ride?.driver_id ? [ride.driver_id] : [];
  }))];
  const [{ data: cities }, { data: drivers }] = await Promise.all([
    cityIds.length ? supabase.from("cities").select("id, name_en").in("id", cityIds) : Promise.resolve({ data: [] }),
    acceptedDriverIds.length ? supabase.from("profiles").select("id, full_name, phone, instagram, facebook").in("id", acceptedDriverIds) : Promise.resolve({ data: [] }),
  ]);
  const cityMap = new Map((cities ?? []).map((city) => [city.id, city.name_en]));
  const driverMap = new Map((drivers ?? []).map((driver) => [driver.id, driver]));
  const ratingControls = await getRatingControls(userId, rides ?? [], (bookings ?? []).map((booking) => ({ ...booking, passenger_id: userId })));
  // Request-time expiry is intentional in this uncached Server Component.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return <div className="dashboard-grid">
        {bookings?.map((booking) => {
          const ride = rides?.find((entry) => entry.id === booking.ride_id);
          if (!ride) return null;
          const driver = ride.driver_id ? driverMap.get(ride.driver_id) : null;
          const contact = driver?.phone || driver?.instagram || driver?.facebook;
          const rideIsCompleted = ride.status === "completed";
          const rideIsCancelled = ride.status === "cancelled";
          const status = rideIsCancelled ? "Ride cancelled" : rideIsCompleted ? "Ride completed" : booking.status === "accepted" ? "Confirmed" : booking.status === "requested" ? "Awaiting approval" : booking.status;
          return <article key={booking.id} className="journey-card">
            <div className="journey-card-top">
              <p className="journey-card-date">{formatDeparture(ride.departure_at)}</p>
              <span className={`status-pill ${rideIsCancelled ? "bg-red-50 text-red-800" : booking.status === "accepted" ? "bg-emerald-50 text-emerald-800" : ""}`}>{status}</span>
            </div>
            <h2 className="journey-card-route">{cityMap.get(ride.origin_city_id)} <span>to</span> {cityMap.get(ride.dest_city_id)}</h2>
            <div className="journey-card-meta">
              <p className="text-slate-600">Skopje time</p>
              <p className="text-xl font-medium">{ride.price_per_seat_mkd === null ? "Flexible price" : <>{ride.price_per_seat_mkd} MKD <span className="text-sm font-normal text-slate-500">/ seat</span></>}</p>
            </div>
            {rideIsCancelled ? <p role="alert" className="mt-5 text-red-800">The driver cancelled this ride. Please make other travel plans.</p> : null}
            {booking.status === "accepted" && !rideIsCancelled ? <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-emerald-900"><p className="font-medium">{rideIsCompleted ? "Travelled" : "You’re confirmed"}{driver ? ` with ${driver.full_name}` : ""}.</p><p className="mt-2 text-sm">Driver contact: {contact || "No contact added. Use the ride Q&A to arrange your meetup."}</p></div> : null}
            <nav aria-label="Trip actions" className="mt-6 flex flex-wrap gap-3">
              <Link href={`/rides/${ride.id}`} className="btn-secondary flex-1">View trip</Link>
              {booking.status === "accepted" && ride.driver_id ? <Link href={`/rides/${ride.id}/chat`} className="btn-primary flex-1">Open ride chat</Link> : null}
              {rideIsCompleted || rideIsCancelled ? <Link href="/rides" className="btn-secondary w-full">Find your next ride</Link> : null}
            </nav>
            {booking.status === "requested" ? <p className="mt-3 text-sm text-slate-600">Ride chat becomes available when the driver accepts your booking.</p> : null}
            {booking.status === "accepted" && ride.driver_id ? <RatingControl state={ratingControls.get(ride.id)?.get(ride.driver_id)} rideId={ride.id} rateeId={ride.driver_id} targetName={driver?.full_name ?? "your driver"} /> : null}
            {booking.status === "accepted" || booking.status === "requested" ? <details className="card-options">
              <summary>Booking options</summary>
              {booking.status === "accepted" && !rideIsCancelled ? <TripShareControls bookingId={booking.id} expiresAt={new Date(Date.parse(ride.departure_at) + 86400000).toISOString()} expired={Date.parse(ride.departure_at) + 86400000 <= now} /> : null}
              <form action={cancelBooking.bind(null, booking.id)} className="mt-4"><SubmitButton pendingLabel="Cancelling…" className="btn-quiet text-red-700 disabled:opacity-60">Cancel booking</SubmitButton></form>
            </details> : null}
          </article>;
        })}
        {!bookings?.length ? <div className="journey-card dashboard-empty"><h2>No trip requests yet</h2><p>Your booked journeys will appear here.</p><Link href="/rides" className="btn-primary">Find your first ride</Link></div> : null}
      </div>;
}
