import Link from "next/link";

import { SeatAvailability } from "@/components/seat-availability";
import { formatDeparture, type RideView } from "@/lib/rides/ride-view";

export function RideCard({ ride }: { ride: RideView }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <p className="text-sm font-semibold text-emerald-700">{formatDeparture(ride.departure_at)}</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">
            {ride.originCity.name_en} <span className="text-slate-400">→</span> {ride.destinationCity.name_en}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {ride.driver?.full_name ?? "Imported ride"}
            {ride.driver ? ` · ${ride.driver.university}` : ""}
          </p>
          {ride.car ? <p className="mt-1 text-sm text-slate-500">{ride.car.color ? `${ride.car.color} ` : ""}{ride.car.make} {ride.car.model}</p> : null}
        </div>
        <div className="sm:text-right">
          <p className="text-xl font-bold text-slate-950">
            {ride.price_per_seat_mkd === null ? "Agree with driver" : `${ride.price_per_seat_mkd} MKD`}
          </p>
          <p className="text-xs text-slate-500">per seat</p>
        </div>
      </div>
      <div className="mt-5 flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
        <SeatAvailability available={ride.seats_available} total={ride.seats_total} />
        <Link className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700" href={`/rides/${ride.id}`}>
          View ride
        </Link>
      </div>
    </article>
  );
}
