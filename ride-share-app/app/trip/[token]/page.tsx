import type { Metadata } from "next";
import Link from "next/link";
import { getSharedItinerary } from "@/lib/sharing/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared itinerary",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default async function SharedTripPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const itinerary = await getSharedItinerary(token);
  if (!itinerary) return <main id="main-content" className="mx-auto w-full max-w-xl px-4 py-12">
    <h1 className="font-display text-3xl font-extrabold tracking-[-.035em]">Itinerary unavailable</h1>
    <p className="mt-3 text-slate-600">This link may have expired or been revoked, or the trip is no longer confirmed. Ask the passenger for an updated itinerary.</p>
    <Link href="/" className="btn-secondary mt-6">Back to home</Link>
  </main>;

  return <main id="main-content" className="mx-auto w-full max-w-xl px-4 py-12 text-slate-950">
    <h1 className="font-display text-4xl font-extrabold tracking-[-.04em]">Shared itinerary</h1>
    <p className="mt-3 text-slate-600">This is a planned itinerary, not live tracking. It does not confirm the traveller’s current location.</p>
    <section className="mt-6 surface-card p-6">
      <h2 className="font-display text-2xl font-bold tracking-tight">{itinerary.origin} <span className="text-slate-400">to</span> {itinerary.destination}</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div><dt className="font-semibold">Departure (Skopje time)</dt><dd>{new Date(itinerary.departureAt).toLocaleString("en-GB", { timeZone: "Europe/Skopje", dateStyle: "full", timeStyle: "short" })}</dd></div>
        <div><dt className="font-semibold">Pickup</dt><dd>{itinerary.pickup ?? "Not specified"}</dd></div>
        <div><dt className="font-semibold">Drop-off</dt><dd>{itinerary.dropoff ?? "Not specified"}</dd></div>
      </dl>
      {itinerary.driver ? <div className="mt-5 flex items-center gap-3">
        {/* A plain image carries an explicit policy so the bearer URL never becomes an image referrer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={itinerary.driver.photoUrl} alt="Driver" referrerPolicy="no-referrer" width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
        <div><p className="text-sm text-slate-600">Driver</p><p className="font-semibold">{itinerary.driver.name}</p></div>
      </div> : <p className="mt-5 text-sm">Driver details unavailable.</p>}
      <p className="mt-4 text-sm"><span className="font-semibold">Car: </span>{itinerary.car ? [itinerary.car.make, itinerary.car.model, itinerary.car.color].filter(Boolean).join(" · ") : "Not specified"}</p>
    </section>
    <p className="mt-4 text-sm text-slate-600">Access expires 24 hours after departure and can be revoked by the passenger.</p>
  </main>;
}
