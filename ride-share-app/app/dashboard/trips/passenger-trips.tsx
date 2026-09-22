import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";
import { TripShareControls } from "@/components/trip-share-controls";
import { ChatIcon } from "@/components/chat-icon";
import { RatingControl } from "@/components/ratings/rating-control";
import { getRatingControls } from "@/lib/ratings/queries";
import { formatDeparture } from "@/lib/rides/ride-presentation";
import { createClient } from "@/lib/supabase/server";

import { cancelBooking } from "../actions";
import { passengerTripStatus } from "./passenger-trip-status";
import { TripStatusFilterNav } from "./trip-status-filter-nav";
import { tripStatusFilters, type TripStatusFilter } from "./trip-tabs";

const emptyStates: Record<TripStatusFilter, { title: string; body: string }> = {
  active: { title: "No active trips", body: "Your pending requests and confirmed bookings will appear here." },
  completed: { title: "No completed trips yet", body: "Trips you took will appear here once the driver marks them complete." },
  cancelled: { title: "No cancelled trips", body: "Cancelled bookings and rides will appear here." },
  all: { title: "No trip requests yet", body: "Your booked journeys will appear here." },
};

export async function PassengerTrips({ userId, filter }: { userId: string; filter: TripStatusFilter }) {
  const supabase = await createClient();
  const { data: bookings, error } = await supabase.from("bookings").select("id, ride_id, seats, message, status, created_at").eq("passenger_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load your trips.");
  const rideIds = [...new Set((bookings ?? []).map((booking) => booking.ride_id))];
  const { data: rides, error: ridesError } = rideIds.length ? await supabase.from("rides").select("id, driver_id, departure_at, origin_city_id, dest_city_id, price_per_seat_mkd, status").in("id", rideIds) : { data: [], error: null };
  if (ridesError) throw new Error("Unable to load your trips.");
  const rideMap = new Map((rides ?? []).map((ride) => [ride.id, ride]));
  const allTrips = (bookings ?? []).flatMap((booking) => {
    const ride = rideMap.get(booking.ride_id);
    return ride ? [{ booking, ride, status: passengerTripStatus(booking.status, ride.status) }] : [];
  });
  const trips = allTrips.filter((trip) => filter === "all" || trip.status.filter === filter);
  const counts = Object.fromEntries(tripStatusFilters.map((option) => [option.value,
    allTrips.filter((trip) => option.value === "all" || trip.status.filter === option.value).length]));
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

  return <TripStatusFilterNav view="passenger" filter={filter} counts={counts}>
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        {trips.map(({ booking, ride, status }) => {
          const driver = ride.driver_id ? driverMap.get(ride.driver_id) : null;
          const contact = driver?.phone || driver?.instagram || driver?.facebook;
          const rideIsCompleted = ride.status === "completed";
          const rideIsCancelled = ride.status === "cancelled";
          const departure = new Date(ride.departure_at);
          const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", weekday: "short", timeZone: "Europe/Skopje" }).format(departure);
          const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Skopje" }).format(departure);
          const canCancel = status.filter === "active";
          const canShare = booking.status === "accepted" && !rideIsCancelled;
          const statusColor = status.filter === "cancelled" || booking.status === "declined"
            ? "bg-red-50 text-red-800"
            : booking.status === "accepted" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600";
          return <article key={booking.id} className="surface-card min-w-0 p-5 text-slate-950 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-[.8125rem] font-semibold ${statusColor}`}>{status.label}</span>
              <span className="text-[.8125rem] font-medium text-slate-600">{booking.seats} {booking.seats === 1 ? "seat" : "seats"}{booking.status === "accepted" ? " booked" : booking.status === "requested" ? " requested" : ""}</span>
            </div>
            <h2 className="journey-card-route">
              <Link href={`/rides/${ride.id}`} className="rounded-sm hover:text-brand-700 hover:underline underline-offset-4">
                {cityMap.get(ride.origin_city_id)} <span className="font-medium">to</span> {cityMap.get(ride.dest_city_id)}
              </Link>
            </h2>
            <div className="mt-3 flex items-start justify-between gap-3">
              <time dateTime={ride.departure_at} aria-label={`${formatDeparture(ride.departure_at)}, Skopje time`} className="min-w-0">
                <span className="flex flex-col items-start text-[1.375rem] font-bold leading-7 text-brand-800 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                  <span>{date}</span><span aria-hidden="true" className="hidden text-slate-300 sm:inline">·</span><span className="tabular-nums">{time}</span>
                </span>
                <span className="block text-[.75rem] leading-5 text-slate-500">Skopje time</span>
              </time>
              <div className="ml-auto shrink-0 text-right">
                <p className="text-2xl font-bold leading-7 tracking-tight">{ride.price_per_seat_mkd === null ? "Flexible" : `${ride.price_per_seat_mkd} MKD`}</p>
                <p className="text-[.75rem] leading-5 text-slate-500">per seat</p>
                {booking.seats > 1 && ride.price_per_seat_mkd !== null ? <p className="mt-1 text-[.8125rem] font-medium text-slate-600">{ride.price_per_seat_mkd * booking.seats} MKD total</p> : null}
              </div>
            </div>
            {rideIsCancelled ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">The driver cancelled this ride. Please make other travel plans.</p> : null}
            {booking.status === "accepted" && !rideIsCancelled ? <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-[.75rem] font-medium text-slate-500">{rideIsCompleted ? "Travelled with" : "Your driver"}</p>
              <p className="font-semibold">{driver?.full_name ?? "Driver details unavailable"}</p>
              <p className="mt-1 text-sm text-slate-600"><span className="font-medium">Contact:</span> {contact || "Use the ride chat to arrange your meetup."}</p>
            </div> : null}
            <nav aria-label="Trip actions" className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Link href={`/rides/${ride.id}`} className="btn-secondary flex-1">View trip</Link>
              {booking.status === "accepted" && ride.driver_id ? <Link href={`/rides/${ride.id}/chat`} className="btn-primary flex-1" aria-label={`Open ride chat for ${cityMap.get(ride.origin_city_id)} to ${cityMap.get(ride.dest_city_id)}`}><ChatIcon /> Open ride chat</Link> : null}
              {rideIsCompleted || rideIsCancelled ? <Link href="/rides" className="btn-secondary w-full">Find your next ride</Link> : null}
            </nav>
            {booking.status === "requested" && canCancel ? <p className="mt-3 text-sm text-slate-600">Ride chat becomes available when the driver accepts your booking.</p> : null}
            {booking.status === "accepted" && ride.driver_id ? <RatingControl state={ratingControls.get(ride.id)?.get(ride.driver_id)} rideId={ride.id} rateeId={ride.driver_id} targetName={driver?.full_name ?? "your driver"} /> : null}
            {canCancel || canShare ? <details className="card-options mt-4">
              <summary>Booking options</summary>
              {canShare ? <TripShareControls bookingId={booking.id} expiresAt={new Date(Date.parse(ride.departure_at) + 86400000).toISOString()} expired={Date.parse(ride.departure_at) + 86400000 <= now} /> : null}
              {canCancel ? <form action={cancelBooking.bind(null, booking.id)} className="mt-4"><SubmitButton pendingLabel="Cancelling…" className="btn-quiet text-red-700 disabled:opacity-60">Cancel booking</SubmitButton></form> : null}
            </details> : null}
          </article>;
        })}
        {!trips.length ? <div className="journey-card dashboard-empty"><h2>{allTrips.length ? emptyStates[filter].title : emptyStates.all.title}</h2><p>{allTrips.length ? emptyStates[filter].body : emptyStates.all.body}</p><Link href="/rides" className="btn-primary">{allTrips.length ? "Find a ride" : "Find your first ride"}</Link></div> : null}
      </div>
    </TripStatusFilterNav>;
}
