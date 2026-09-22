import Link from "next/link";

import { formatDeparture } from "@/lib/rides/ride-presentation";
import { SeatAvailability } from "@/components/seat-availability";
import type { RideView } from "@/lib/rides/ride-view";

export function RideCard({ ride, explanation }: { ride: RideView; explanation?: string }) {
  const departure = new Date(ride.departure_at);
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", weekday: "short", timeZone: "Europe/Skopje" }).format(departure);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Skopje" }).format(departure);

  return (
    <article className="ride-choice-card surface-card flex min-w-0 flex-col gap-2 p-4 text-slate-950">
      <h2 className="journey-card-route">{ride.originCity.name_en}<span className="mx-1.5 font-medium">to</span>{ride.destinationCity.name_en}</h2>
      <div className="flex items-start justify-between gap-3">
        <time dateTime={ride.departure_at} aria-label={`${formatDeparture(ride.departure_at)}, Skopje time`} className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2 text-[1.375rem] font-bold leading-7 text-brand-800">
            <span>{date}</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="tabular-nums">{time}</span>
          </span>
          <span className="block text-[.6875rem] leading-4 text-slate-500">Skopje time</span>
        </time>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold leading-7 tracking-tight">{ride.price_per_seat_mkd === null ? "Flexible" : `${ride.price_per_seat_mkd} MKD`}</p>
          <p className="text-[.6875rem] leading-4 text-slate-500">per seat</p>
        </div>
      </div>
      {ride.originPickup || ride.destinationPickup ? (
        <dl className="grid gap-x-4 gap-y-1 text-[.8125rem] leading-5 text-slate-600 sm:grid-cols-2">
          <div className="flex min-w-0 gap-1"><dt className="shrink-0 font-semibold">Pickup:</dt><dd className="truncate" title={ride.originPickup?.name_en ?? "Arrange with driver"}>{ride.originPickup?.name_en ?? "Arrange with driver"}</dd></div>
          <div className="flex min-w-0 gap-1"><dt className="shrink-0 font-semibold">Drop-off:</dt><dd className="truncate" title={ride.destinationPickup?.name_en ?? "Arrange with driver"}>{ride.destinationPickup?.name_en ?? "Arrange with driver"}</dd></div>
        </dl>
      ) : <p className="text-[.8125rem] leading-5 text-slate-500">Pickup & drop-off arranged with driver</p>}
      {explanation ? <p className="text-[.8125rem] leading-snug text-slate-600">{explanation}</p> : null}
      <div className={`mt-auto items-center gap-2 border-t border-slate-100 pt-3 ${ride.seats_total > 4 ? "grid grid-cols-[2rem_minmax(0,1fr)_auto] sm:flex" : "flex"}`}>
        {ride.driver ? (
          /* Profile-photo hosts depend on the user's project. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={ride.driver.photo_url} alt="" loading="lazy" width={32} height={32} className="size-8 shrink-0 rounded-full bg-slate-50 object-cover" />
        ) : <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold">SR</span>}
        <div className="col-span-2 min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1 text-[.8125rem] font-semibold">
            <span className="truncate" title={ride.driver?.full_name ?? "Imported ride"}>{ride.driver?.full_name ?? "Imported ride"}</span>
            {ride.driver?.verified_at ? (
              <svg width="16" height="16" viewBox="0 0 24 24" role="img" aria-label="Verified driver" className="shrink-0 text-brand-600">
                <title>Verified driver</title>
                <path d="m12 3.7 3.3-1.4 1.8 2.9 3.4.8-.3 3.4 2.3 2.6-2.3 2.6.3 3.4-3.4.8-1.8 2.9-3.3-1.4-3.3 1.4-1.8-2.9-3.4-.8.3-3.4L1.5 12l2.3-2.6-.3-3.4 3.4-.8 1.8-2.9Z" fill="currentColor" />
                <path d="m7.5 12 3 3 6-6" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </p>
          <p className="truncate text-[.6875rem] text-slate-500">{ride.car ? `${ride.car.color ? `${ride.car.color} ` : ""}${ride.car.make} ${ride.car.model}` : ride.driver?.university ?? "Driver details coming soon"}</p>
        </div>
        <div className="col-span-2 shrink-0"><SeatAvailability available={ride.seats_available} total={ride.seats_total} compact /></div>
        <Link className="btn-primary min-h-11 shrink-0 px-3 py-2 text-[.8125rem]" href={`/rides/${ride.id}`} aria-label={`View ride from ${ride.originCity.name_en} to ${ride.destinationCity.name_en}`}>Choose ride</Link>
      </div>
    </article>
  );
}
