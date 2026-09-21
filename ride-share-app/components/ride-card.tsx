import Link from "next/link";

import { RideRoute } from "@/components/ride-route";
import { SeatAvailability } from "@/components/seat-availability";
import { formatDeparture } from "@/lib/rides/ride-presentation";
import type { RideView } from "@/lib/rides/ride-view";

export function RideCard({ ride, explanation }: { ride: RideView; explanation?: string }) {
  return (
    <article className="ride-choice-card surface-card flex flex-col overflow-hidden text-slate-950">
      <div className="driver-strip flex items-center gap-3 p-5 pb-0 sm:p-6 sm:pb-0">
        {ride.driver ? (
          /* Profile-photo hosts depend on the user's project. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={ride.driver.photo_url} alt="" loading="lazy" width={56} height={56} className="size-12 shrink-0 rounded-full bg-slate-50 object-cover sm:size-14" />
        ) : (
          <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-2xl bg-slate-100 text-xl font-semibold text-slate-600">SR</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium">{ride.driver?.full_name ?? "Imported ride"}</p>
          <p className="truncate text-xs text-slate-600">{ride.driver?.university ?? "Driver details coming soon"}</p>
        </div>
        {ride.driver?.verified_at ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[.65rem] font-medium text-emerald-800">Verified</span> : null}
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-coral-700">{formatDeparture(ride.departure_at)}</p>
            <p className="mt-1 text-xs text-slate-500">Skopje time</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-medium tracking-tight text-slate-950">{ride.price_per_seat_mkd === null ? "Flexible" : `${ride.price_per_seat_mkd} MKD`}</p>
            <p className="text-xs text-slate-500">per seat</p>
          </div>
        </div>
        <h2 className="sr-only">{ride.originCity.name_en} to {ride.destinationCity.name_en}</h2>
        <div className="rounded-2xl bg-slate-50 p-5"><RideRoute origin={ride.originCity.name_en} destination={ride.destinationCity.name_en} pickup={ride.originPickup?.name_en} dropoff={ride.destinationPickup?.name_en} /></div>
        {ride.car ? <p className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-600">{ride.car.color ? `${ride.car.color} ` : ""}{ride.car.make} {ride.car.model}</p> : null}
        {explanation ? <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-950">{explanation}</p> : null}
        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-200 pt-4">
            <SeatAvailability available={ride.seats_available} total={ride.seats_total} />
            <Link className="btn-primary" href={`/rides/${ride.id}`} aria-label={`View ride from ${ride.originCity.name_en} to ${ride.destinationCity.name_en}`}>Choose ride <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </article>
  );
}
