import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { SeatAvailability } from "@/components/seat-availability";
import { requireCompleteProfile } from "@/lib/auth/session";
import { formatDeparture } from "@/lib/rides/ride-view";
import { createClient } from "@/lib/supabase/server";

import { decideBooking } from "../actions";

export const metadata: Metadata = { title: "Driver dashboard" };

export default async function DriverDashboard({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const user = await requireCompleteProfile("/dashboard/driver");
  const supabase = await createClient();
  const { data: rides, error } = await supabase
    .from("rides")
    .select("id, departure_at, status, seats_total, seats_available, origin_city_id, dest_city_id")
    .eq("driver_id", user.id)
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
  const acceptedPassengerIds = [...new Set((bookings ?? []).filter((booking) => booking.status === "accepted").map((booking) => booking.passenger_id))];
  const [{ data: passengers }, { data: acceptedContacts }] = await Promise.all([
    passengerIds.length
      ? supabase.from("profiles").select("id, full_name, photo_url, university").in("id", passengerIds)
      : Promise.resolve({ data: [] }),
    acceptedPassengerIds.length
      ? supabase.from("profiles").select("id, phone, instagram, facebook").in("id", acceptedPassengerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const cityMap = new Map((cities ?? []).map((city) => [city.id, city.name_en]));
  const passengerMap = new Map((passengers ?? []).map((passenger) => [passenger.id, passenger]));
  const contactMap = new Map((acceptedContacts ?? []).map((contact) => [contact.id, contact]));
  const notice = await searchParams;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950"><AppHeader /><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Driver dashboard</p><h1 className="mt-2 text-3xl font-bold">Your offered rides</h1></div><Link href="/rides/new" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">Offer a ride</Link></div>
      {notice.success ? <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{notice.success}</p> : null}
      {notice.error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{notice.error}</p> : null}
      <div className="mt-7 space-y-5">
        {rides?.map((ride) => {
          const rideBookings = (bookings ?? []).filter((booking) => booking.ride_id === ride.id);
          return <section key={ride.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href={`/rides/${ride.id}`} className="text-xl font-bold hover:underline">{cityMap.get(ride.origin_city_id)} → {cityMap.get(ride.dest_city_id)}</Link><p className="mt-1 text-sm text-slate-600">{formatDeparture(ride.departure_at)} · <span className="capitalize">{ride.status}</span></p></div><SeatAvailability available={ride.seats_available} total={ride.seats_total} /></div>
            <h2 className="mt-6 border-t border-slate-100 pt-5 font-bold">Seat requests</h2>
            {rideBookings.length ? <div className="mt-3 space-y-3">{rideBookings.map((booking) => {
              const passenger = passengerMap.get(booking.passenger_id);
              const contact = contactMap.get(booking.passenger_id);
              return <article key={booking.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="font-semibold">{passenger?.full_name ?? "Student"} · {booking.seats} seat{booking.seats === 1 ? "" : "s"}</p><p className="text-sm text-slate-600">{passenger?.university}</p>{booking.message ? <p className="mt-2 text-sm text-slate-700">“{booking.message}”</p> : null}{booking.status === "accepted" ? <p className="mt-2 text-sm text-emerald-800">Contact: {contact?.phone || contact?.instagram || contact?.facebook || "No contact method added"}</p> : null}</div><div className="flex items-center gap-2">{booking.status === "requested" ? <><form action={decideBooking.bind(null, booking.id, "accepted")}><button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Accept</button></form><form action={decideBooking.bind(null, booking.id, "declined")}><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Decline</button></form></> : <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${booking.status === "accepted" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{booking.status}</span>}</div></div></article>;
            })}</div> : <p className="mt-3 text-sm text-slate-500">No requests yet.</p>}
          </section>;
        })}
        {!rides?.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center"><h2 className="text-xl font-bold">No rides offered yet</h2><p className="mt-2 text-slate-600">Publish a ride to start receiving requests.</p></div> : null}
      </div>
    </main></div>
  );
}
