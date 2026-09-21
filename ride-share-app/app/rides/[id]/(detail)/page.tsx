import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SeatAvailability } from "@/components/seat-availability";
import { RideRoute } from "@/components/ride-route";
import { SubmitButton } from "@/components/submit-button";
import { ChatIcon } from "@/components/chat-icon";
import { RideComments } from "@/components/ride-comments/ride-comments";
import { requireCompleteProfile } from "@/lib/auth/session";
import { canViewRideDetail } from "@/lib/rides/ride-detail-access";
import { formatDeparture, getRide } from "@/lib/rides/ride-view";
import { createClient } from "@/lib/supabase/server";

import { requestBooking } from "../actions";

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
  const canChat = Boolean(ride.driver_id) && (ride.driver_id === user.id || booking?.status === "accepted");
  const route = `${ride.originCity.name_en} to ${ride.destinationCity.name_en}`;
  const canRequest = ride.driver_id !== user.id && ride.status === "published" && ride.seats_available > 0 && !booking;

  return (
    <div className="text-slate-950">
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/rides" className="text-sm font-semibold text-brand-700 hover:underline">Back to rides</Link>
        {notice.success ? <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{notice.success}</p> : null}
        {notice.error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{notice.error}</p> : null}

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_350px]">
          <section className="surface-card p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-brand-700">{formatDeparture(ride.departure_at)} · Skopje time</p><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{ride.status}</span></div>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-[-.04em]">{ride.originCity.name_en} <span className="text-slate-400">to</span> {ride.destinationCity.name_en}</h1>
            <div className="mt-6 rounded-xl bg-slate-50 p-5">
              <RideRoute origin={ride.originCity.name_en} destination={ride.destinationCity.name_en} pickup={ride.originPickup?.name_en} dropoff={ride.destinationPickup?.name_en} />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-5 border-b border-slate-100 pb-6">
              <SeatAvailability available={ride.seats_available} total={ride.seats_total} />
              <div className="text-right"><p className="font-display text-2xl font-extrabold tracking-tight">{ride.price_per_seat_mkd === null ? "Flexible" : `${ride.price_per_seat_mkd} MKD`}</p><p className="text-sm text-slate-500">per seat</p></div>
            </div>
            {ride.notes ? <div className="mt-6"><h2 className="font-bold">Driver notes</h2><p className="mt-2 whitespace-pre-wrap text-slate-600">{ride.notes}</p></div> : null}
            {ride.tags.length ? <div className="mt-5 flex flex-wrap gap-2">{ride.tags.map((tag) => <span key={tag} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{tag.replaceAll("_", " ")}</span>)}</div> : null}
          </section>

          <aside className="space-y-5">
            {canChat ? <section aria-labelledby="ride-chat-heading" className="surface-card border-brand-200! bg-brand-50 p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white"><ChatIcon /></span>
                <div><h2 id="ride-chat-heading" className="font-display text-xl font-bold tracking-tight">Ride chat</h2><p className="text-sm text-slate-600">Plan pickup with {ride.driver_id === user.id ? "your passengers" : "your driver and passengers"}.</p></div>
              </div>
              <Link href={`/rides/${id}/chat`} className="btn-primary mt-4 w-full" aria-label={`Open ride chat for ${route}`}><ChatIcon /> Open ride chat</Link>
            </section> : null}
            <section className="surface-card overflow-hidden p-6 text-slate-950">
              {ride.driver ? <>
                <div className="flex items-center gap-4">
                  {/* User/project-specific hosts cannot use a fixed Next Image allowlist. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ride.driver.photo_url} alt="" width={64} height={64} className="size-16 shrink-0 rounded-full bg-blue-50 object-cover" />
                  <div><p className="text-sm font-medium text-slate-500">Your driver</p>{ride.driver.verified_at ? <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">Verified driver</span> : null}</div>
                </div>
                <Link href={`/profile/${ride.driver.id}`} className="mt-4 block font-display text-xl font-bold tracking-tight hover:text-brand-700">{ride.driver.full_name}</Link><p className="mt-1 text-sm text-slate-600">{ride.driver.university}</p>{ride.car ? <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">{ride.car.color ? `${ride.car.color} ` : ""}{ride.car.make} {ride.car.model}</p> : null}
              </> : <p className="p-5 text-sm text-slate-600">Imported ride awaiting a driver.</p>}
            </section>

            <section className="surface-card p-5">
              <h2 className="font-display text-xl font-bold tracking-tight">Request a seat</h2>
              {booking ? <div className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold capitalize">{booking.status}</p><p className="mt-1">Your seat request is with the driver.</p><Link className="mt-2 inline-block font-semibold underline" href="/dashboard/trips">Manage in My trips</Link></div> : null}
              {canRequest ? <form action={requestAction} className="mt-4 space-y-4">
                <label className="block text-sm font-semibold">Message <span className="font-normal text-slate-500">(optional)</span><textarea name="message" maxLength={1000} rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Introduce yourself or mention luggage." /></label>
                <SubmitButton pendingLabel="Sending request…" className="btn-primary w-full disabled:opacity-60">Request my seat</SubmitButton>
                <p className="text-xs leading-5 text-slate-500">Each request reserves one seat, just for you. It is confirmed when the driver accepts. Track the response in My trips.</p>
                {ride.gender_preference === "same_as_driver" ? <p className="text-xs text-slate-500">This ride accepts same-gender requests only.</p> : null}
              </form> : null}
              {!booking && !canRequest ? <p className="mt-3 text-sm text-slate-600">{ride.driver_id === user.id ? "This is your ride. Manage requests from the driver dashboard." : "This ride is not accepting requests."}</p> : null}
              {ride.driver_id === user.id ? <Link href="/dashboard/trips?view=driver" className="btn-primary mt-4 w-full">Manage my ride</Link> : !booking && !canRequest ? <Link href="/rides" className="btn-secondary mt-4 w-full">Find another ride</Link> : null}
            </section>
          </aside>
        </div>
        <RideComments rideId={id} />
      </main>
    </div>
  );
}
