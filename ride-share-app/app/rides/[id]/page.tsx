import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { SeatAvailability } from "@/components/seat-availability";
import { RideComments } from "@/components/ride-comments/ride-comments";
import { requireCompleteProfile } from "@/lib/auth/session";
import { canViewRideDetail } from "@/lib/rides/ride-detail-access";
import { formatDeparture, getRide } from "@/lib/rides/ride-view";
import { createClient } from "@/lib/supabase/server";

import { requestBooking } from "./actions";

export const metadata: Metadata = { title: "Ride details" };

type RideDetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function RideDetailPage({ params, searchParams }: RideDetailProps) {
  const { id } = await params;
  const user = await requireCompleteProfile(`/rides/${id}`);
  const ride = await getRide(id);
  if (!ride) notFound();

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, seats, status, message")
    .eq("ride_id", id)
    .eq("passenger_id", user.id)
    .in("status", ["requested", "accepted"])
    .maybeSingle();
  if (!canViewRideDetail({
    rideStatus: ride.status,
    isDriver: ride.driver_id === user.id,
    bookingStatus: booking?.status,
  })) notFound();
  const notice = await searchParams;
  const requestAction = requestBooking.bind(null, id);
  const canRequest = ride.driver_id !== user.id && ride.status === "published" && ride.seats_available > 0 && !booking;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/rides" className="text-sm font-semibold text-emerald-700 hover:underline">← Back to rides</Link>
        {notice.success ? <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{notice.success}</p> : null}
        {notice.error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{notice.error}</p> : null}

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-semibold text-emerald-700">{formatDeparture(ride.departure_at)}</p>
            <h1 className="mt-2 text-3xl font-bold">{ride.originCity.name_en} <span className="text-slate-400">→</span> {ride.destinationCity.name_en}</h1>
            <div className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-2">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pickup</p><p className="mt-1 font-semibold">{ride.originPickup?.name_en ?? ride.originCity.name_en}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drop-off</p><p className="mt-1 font-semibold">{ride.destinationPickup?.name_en ?? ride.destinationCity.name_en}</p></div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-5 border-b border-slate-100 pb-6">
              <SeatAvailability available={ride.seats_available} total={ride.seats_total} />
              <div className="text-right"><p className="text-2xl font-bold">{ride.price_per_seat_mkd === null ? "Flexible" : `${ride.price_per_seat_mkd} MKD`}</p><p className="text-sm text-slate-500">per seat</p></div>
            </div>
            {ride.notes ? <div className="mt-6"><h2 className="font-bold">Driver notes</h2><p className="mt-2 whitespace-pre-wrap text-slate-600">{ride.notes}</p></div> : null}
            {ride.tags.length ? <div className="mt-5 flex flex-wrap gap-2">{ride.tags.map((tag) => <span key={tag} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{tag.replaceAll("_", " ")}</span>)}</div> : null}
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Driver</p>
              {ride.driver ? <div className="mt-3 flex items-center gap-3">
                {/* User/project-specific hosts cannot use a fixed Next Image allowlist. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ride.driver.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                <div><Link href={`/profile/${ride.driver.id}`} className="font-bold hover:underline">{ride.driver.full_name}</Link><p className="text-sm text-slate-600">{ride.driver.university}</p></div>
              </div> : <p className="mt-2 text-sm text-slate-600">Imported ride awaiting a driver.</p>}
              {ride.car ? <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">{ride.car.color ? `${ride.car.color} ` : ""}{ride.car.make} {ride.car.model}</p> : null}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold">Request seats</h2>
              {booking ? <div className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold capitalize">{booking.status}</p><p className="mt-1">{booking.seats} seat{booking.seats === 1 ? "" : "s"} requested.</p><Link className="mt-2 inline-block font-semibold underline" href="/dashboard/trips">Manage in My trips</Link></div> : null}
              {canRequest ? <form action={requestAction} className="mt-4 space-y-4">
                <label className="block text-sm font-semibold">Seats<select name="seats" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">{Array.from({ length: ride.seats_available }, (_, index) => index + 1).map((seat) => <option key={seat} value={seat}>{seat}</option>)}</select></label>
                <label className="block text-sm font-semibold">Message <span className="font-normal text-slate-500">(optional)</span><textarea name="message" maxLength={1000} rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Introduce yourself or mention luggage." /></label>
                <button type="submit" className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800">Send request</button>
                {ride.gender_preference === "same_as_driver" ? <p className="text-xs text-slate-500">This ride accepts same-gender requests only.</p> : null}
              </form> : null}
              {!booking && !canRequest ? <p className="mt-3 text-sm text-slate-600">{ride.driver_id === user.id ? "This is your ride. Manage requests from the driver dashboard." : "This ride is not accepting requests."}</p> : null}
            </section>
          </aside>
        </div>
        <RideComments rideId={id} />
      </main>
    </div>
  );
}
