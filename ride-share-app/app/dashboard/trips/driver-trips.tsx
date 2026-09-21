import { ContactDetails } from "@/components/contact-details";
import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";
import { SeatAvailability } from "@/components/seat-availability";
import { CompleteRideButton } from "@/components/ride-completion/complete-ride-button";
import { CancelRideControl } from "@/components/ride-completion/cancel-ride-control";
import { RatingControl } from "@/components/ratings/rating-control";
import { getRatingControls } from "@/lib/ratings/queries";
import { formatDeparture } from "@/lib/rides/ride-view";
import { createClient } from "@/lib/supabase/server";

import { decideBooking } from "../actions";

export async function DriverRides({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: rides, error } = await supabase
    .from("rides")
    .select("id, departure_at, status, seats_total, seats_available, origin_city_id, dest_city_id")
    .eq("driver_id", userId)
    .order("departure_at", { ascending: false });
  if (error) throw new Error("Unable to load your rides.");

  const rideIds = rides?.map((ride) => ride.id) ?? [];
  const cityIds = [...new Set((rides ?? []).flatMap((ride) => [ride.origin_city_id, ride.dest_city_id]))];
  const [{ data: bookings }, { data: cities }] = await Promise.all([
    rideIds.length
      ? supabase.from("bookings").select("id, ride_id, passenger_id, seats, message, status, created_at").in("ride_id", rideIds).order("created_at")
      : Promise.resolve({ data: [] }),
    cityIds.length ? supabase.from("cities").select("id, name_en").in("id", cityIds) : Promise.resolve({ data: [] }),
  ]);
  const passengerIds = [...new Set((bookings ?? []).map((booking) => booking.passenger_id))];
  const contactPassengerIds = [...new Set((bookings ?? []).filter((booking) => ["requested", "accepted"].includes(booking.status)).map((booking) => booking.passenger_id))];
  const [{ data: passengers }, { data: requestContacts }] = await Promise.all([
    passengerIds.length
      ? supabase.from("profiles").select("id, full_name, photo_url, university").in("id", passengerIds)
      : Promise.resolve({ data: [] }),
    contactPassengerIds.length
      ? supabase.from("profiles").select("id, phone").in("id", contactPassengerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const cityMap = new Map((cities ?? []).map((city) => [city.id, city.name_en]));
  const passengerMap = new Map((passengers ?? []).map((passenger) => [passenger.id, passenger]));
  const contactMap = new Map((requestContacts ?? []).map((contact) => [contact.id, contact]));
  const ratingControls = await getRatingControls(userId, (rides ?? []).map((ride) => ({ ...ride, driver_id: userId })), bookings ?? []);
  // This authenticated Server Component renders a fresh eligibility snapshot per request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return <div className="dashboard-grid">
        {rides?.map((ride) => {
          const rideBookings = (bookings ?? []).filter((booking) => booking.ride_id === ride.id);
          const isOpen = ["published", "full"].includes(ride.status);
          const hasDeparted = Date.parse(ride.departure_at) < now;
          const canDecide = isOpen && Date.parse(ride.departure_at) > now;
          const confirmedSeats = rideBookings.filter((booking) => booking.status === "accepted").reduce((total, booking) => total + booking.seats, 0);
          const pendingRequests = rideBookings.filter((booking) => booking.status === "requested").length;
          const isFull = ride.status === "full" || ride.seats_available === 0;
          return <section key={ride.id} className="journey-card">
            <div className="journey-card-top"><p className="journey-card-date">{formatDeparture(ride.departure_at)}</p><span className={`status-pill ${ride.status === "cancelled" ? "bg-red-50 text-red-800" : isOpen ? "bg-blue-50 text-blue-800" : ""}`}>{ride.status}</span></div>
            <h2><Link href={`/rides/${ride.id}`} className="journey-card-route hover:text-brand-700">{cityMap.get(ride.origin_city_id)} <span>to</span> {cityMap.get(ride.dest_city_id)}</Link></h2>
            <div className="journey-card-meta"><SeatAvailability available={ride.seats_available} total={ride.seats_total} /><p className="text-slate-500">{confirmedSeats} confirmed · Skopje time</p></div>
            {isOpen && hasDeparted ? <CompleteRideButton rideId={ride.id} /> : null}
            <details className="card-options" open={(canDecide && pendingRequests > 0) || ratingControls.has(ride.id)}>
              <summary>{ride.status === "completed" ? "Passengers & feedback" : "Manage ride"}{canDecide && pendingRequests > 0 ? <span className="ml-3 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">{pendingRequests} pending</span> : null}</summary>
              <h3 className="text-xl font-medium">Passenger requests</h3>
              {rideBookings.length ? <div className="mt-5 space-y-5">{rideBookings.map((booking) => {
                const passenger = passengerMap.get(booking.passenger_id);
                const contact = contactMap.get(booking.passenger_id);
                return <article key={booking.id} className="border-b border-slate-100 pb-5 last:border-0">
                  <div className="flex min-w-0 items-start gap-3">
                    {passenger ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={passenger.photo_url} alt="" className="size-12 shrink-0 rounded-full bg-slate-50 object-cover" />
                    ) : <span className="grid size-12 shrink-0 place-items-center rounded-full bg-slate-100 text-sm">SR</span>}
                    <div className="min-w-0">
                      <p className="font-medium">{passenger ? <Link href={`/profile/${passenger.id}`} className="hover:text-brand-700">{passenger.full_name}</Link> : "Student"}</p>
                      <p className="text-sm text-slate-500">{passenger?.university}</p>
                    </div>
                  </div>
                  {booking.message ? <p className="mt-3 text-slate-600">“{booking.message}”</p> : null}
                  {["requested", "accepted"].includes(booking.status) ? <ContactDetails phone={contact?.phone} /> : null}
                  <div className="mt-4 flex flex-wrap gap-3">{booking.status === "requested" && canDecide ? <>
                    <form action={decideBooking.bind(null, booking.id, "accepted")}><SubmitButton pendingLabel="Accepting…" className="btn-primary disabled:opacity-60">Accept</SubmitButton></form>
                    <form action={decideBooking.bind(null, booking.id, "declined")}><SubmitButton pendingLabel="Declining…" className="btn-secondary disabled:opacity-60">Decline</SubmitButton></form>
                  </> : <span className="status-pill">{booking.status}</span>}</div>
                  {booking.status === "accepted" ? <RatingControl state={ratingControls.get(ride.id)?.get(booking.passenger_id)} rideId={ride.id} rateeId={booking.passenger_id} targetName={passenger?.full_name ?? "your passenger"} /> : null}
                </article>;
              })}</div> : <p className="mt-3 text-slate-500">No requests yet.</p>}
              {canDecide ? <CancelRideControl rideId={ride.id} isFull={isFull} confirmedSeats={confirmedSeats} /> : null}
            </details>
          </section>;
        })}
        {!rides?.length ? <div className="journey-card dashboard-empty"><h2>No rides offered yet</h2><p>Have a spare seat? Give someone a way home.</p><Link href="/rides/new" className="btn-primary">Offer your first ride</Link></div> : null}
      </div>;
}
