import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { ImpactSummaryPanel } from "@/components/impact-summary";
import { TripShareControls } from "@/components/trip-share-controls";
import { requireCompleteProfile } from "@/lib/auth/session";
import { formatDeparture } from "@/lib/rides/ride-view";
import { createClient } from "@/lib/supabase/server";

import { cancelBooking } from "../actions";

export const metadata: Metadata = { title: "My trips" };

export default async function TripsDashboard({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const user = await requireCompleteProfile("/dashboard/trips");
  const supabase = await createClient();
  const { data: bookings, error } = await supabase.from("bookings").select("id, ride_id, seats, message, status, created_at").eq("passenger_id", user.id).order("created_at", { ascending: false });
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
  const notice = await searchParams;
  // Request-time expiry is intentional in this uncached Server Component.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return <div className="min-h-screen bg-slate-50 text-slate-950"><AppHeader /><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Passenger dashboard</p><h1 className="mt-2 text-3xl font-bold">My trips</h1><p className="mt-2 text-slate-600">Track requests and find driver contact details after approval.</p>
    {notice.success ? <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{notice.success}</p> : null}
    {notice.error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{notice.error}</p> : null}
    <ImpactSummaryPanel />
    <div className="mt-7 space-y-4">{bookings?.map((booking) => {
      const ride = rides?.find((entry) => entry.id === booking.ride_id);
      if (!ride) return null;
      const driver = ride.driver_id ? driverMap.get(ride.driver_id) : null;
      const contact = driver?.phone || driver?.instagram || driver?.facebook;
      const rideIsCompleted = ride.status === "completed";
      const rideIsCancelled = ride.status === "cancelled";
      return <article key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><Link href={`/rides/${ride.id}`} className="text-xl font-bold hover:underline">{cityMap.get(ride.origin_city_id)} → {cityMap.get(ride.dest_city_id)}</Link><p className="mt-1 text-sm text-slate-600">{formatDeparture(ride.departure_at)} · {booking.seats} seat{booking.seats === 1 ? "" : "s"}</p></div><div className="flex h-fit flex-wrap gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${booking.status === "accepted" ? "bg-emerald-100 text-emerald-800" : booking.status === "requested" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>Booking {booking.status}</span><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${rideIsCompleted ? "bg-blue-100 text-blue-800" : rideIsCancelled ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>Ride {ride.status}</span></div></div>
        {rideIsCompleted ? <div role="status" className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-950"><p className="font-semibold">Ride completed</p><p className="mt-1">The driver marked this ride as completed.</p></div> : null}
        {rideIsCancelled ? <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-950"><p className="font-semibold">Ride cancelled</p><p className="mt-1">The driver cancelled this ride. Please make other travel plans.</p></div> : null}
        {booking.status === "accepted" ? <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">You’re confirmed{driver ? ` with ${driver.full_name}` : ""}.</p><p className="mt-1">Driver contact: {contact || "No contact method has been added; coordinate through the driver dashboard during the demo."}</p></div> : null}
        {booking.status === "accepted" && ride.status !== "cancelled" ? <TripShareControls bookingId={booking.id} expiresAt={new Date(Date.parse(ride.departure_at) + 86400000).toISOString()} expired={Date.parse(ride.departure_at) + 86400000 <= now} /> : null}
        {['requested', 'accepted'].includes(booking.status) ? <form action={cancelBooking.bind(null, booking.id)} className="mt-4"><button className="text-sm font-semibold text-red-700 hover:underline">Cancel booking</button></form> : null}
      </article>;
    })}{!bookings?.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center"><h2 className="text-xl font-bold">No trip requests yet</h2><Link href="/rides" className="mt-3 inline-block font-semibold text-emerald-700 hover:underline">Find a ride</Link></div> : null}</div>
  </main></div>;
}
