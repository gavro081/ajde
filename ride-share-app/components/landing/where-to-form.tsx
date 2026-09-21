"use client";

import Link from "next/link";
import { useState } from "react";
import { DatePill } from "./date-pill";

type City = { id: number; name_en: string };

function CityField({ tag, label, name, value, onChange, cities, loading }: {
  tag: string; label: string; name: string; value: string; onChange: (value: string) => void; cities: City[]; loading: boolean;
}) {
  return <label className="relative flex min-h-[3.6rem] items-center rounded-xl bg-[#f1f4f1] focus-within:ring-2 focus-within:ring-[#16201a]">
    <span aria-hidden="true" className="w-16 shrink-0 pl-4 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#647063]">{tag}</span>
    <span className="sr-only">{label}</span>
    <select name={name} value={value} onChange={(event) => onChange(event.target.value)} disabled={loading}
      className={`min-h-0 w-full appearance-none bg-transparent py-3 pr-14 text-[17px] font-medium outline-none ${value ? "" : "text-[#647063]"}`}>
      <option value="">{loading ? "Loading cities…" : label}</option>
      {cities.map((city) => <option key={city.id} value={city.id}>{city.name_en}</option>)}
    </select>
  </label>;
}

/** Landing search card; submits the origin/destination/date params the ride feed reads. */
export function WhereToForm({ cities, loading = false }: { cities: City[]; loading?: boolean }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  return <form action="/rides" className="w-full rounded-[1.75rem] bg-white/85 p-5 shadow-[0_24px_70px_-20px_rgb(11_42_23/0.35)] backdrop-blur-xl sm:p-6 lg:w-[26rem]">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="whitespace-nowrap font-display text-[1.9rem] font-extrabold tracking-[-0.03em]">Where to?</h2>
      <DatePill name="date" />
    </div>

    <div className="relative mt-5 grid gap-2">
      <CityField tag="From" label="Leaving from" name="origin" value={origin} onChange={setOrigin} cities={cities} loading={loading} />
      <CityField tag="To" label="Going to" name="destination" value={destination} onChange={setDestination} cities={cities} loading={loading} />
      <button type="button" aria-label="Swap departure and destination" disabled={loading || (!origin && !destination)}
        onClick={() => { setOrigin(destination); setDestination(origin); }}
        className="absolute right-3 top-1/2 z-10 grid size-10 min-h-0 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-[#16201a] text-white shadow-md transition hover:rotate-180 disabled:bg-[#849182] disabled:hover:rotate-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" /></svg>
      </button>
    </div>

    <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
      <button type="submit" className="rounded-xl bg-[#16201a] px-6 text-[17px] font-semibold text-white hover:bg-[#2a3a30]">Find a ride</button>
      <Link href="/rides/new" className="group inline-flex items-center gap-2 text-[17px] font-semibold underline decoration-[#16201a]/25 underline-offset-[6px] hover:decoration-[#16201a]">
        Offer a ride <span aria-hidden="true" className="transition group-hover:translate-x-0.5">→</span>
      </Link>
    </div>
    <p className="mt-4 flex items-center gap-2 border-t border-[#16201a]/10 pt-4 text-sm text-[#4c5a50]">
      <span className="size-2 shrink-0 rounded-full bg-[#22c55e]" />A shared trip saves about 21 kg of CO₂.
    </p>
  </form>;
}
