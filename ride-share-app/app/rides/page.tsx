import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { RideCard } from "@/components/ride-card";
import { requireCompleteProfile } from "@/lib/auth/session";
import { parseRideFilters } from "@/lib/rides/ride-filters";
import { getRideFeed } from "@/lib/rides/ride-view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Find a ride" };

type RideFeedPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RideFeedPage({ searchParams }: RideFeedPageProps) {
  await requireCompleteProfile("/rides");
  const filters = parseRideFilters(await searchParams);
  const supabase = await createClient();
  const [{ data: cities, error }, rides] = await Promise.all([
    supabase.from("cities").select("id, name_en, name_mk").order("name_en"),
    getRideFeed(filters),
  ]);
  if (error) throw new Error("Unable to load city filters.");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Student routes</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Find your next ride home</h1>
            <p className="mt-3 text-slate-600">Browse upcoming rides, compare seats and request your place.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/rides/import" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-100">Import post</Link>
            <Link href="/rides/new" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Offer a ride</Link>
          </div>
        </div>

        <form className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-semibold text-slate-700">From
            <select name="origin" defaultValue={filters.origin ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
              <option value="">Anywhere</option>
              {cities?.map((city) => <option key={city.id} value={city.id}>{city.name_en}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">To
            <select name="destination" defaultValue={filters.destination ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
              <option value="">Anywhere</option>
              {cities?.map((city) => <option key={city.id} value={city.id}>{city.name_en}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">Date
            <input name="date" type="date" defaultValue={filters.date ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-700">Seats
            <select name="seats" defaultValue={filters.seats} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>{value}+</option>)}
            </select>
          </label>
          <button className="self-end rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700" type="submit">Apply filters</button>
        </form>

        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-600">{rides.length} matching ride{rides.length === 1 ? "" : "s"}</p>
          <Link href="/rides" className="text-sm font-semibold text-emerald-700 hover:underline">Clear filters</Link>
        </div>
        {rides.length ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">{rides.map((ride) => <RideCard key={ride.id} ride={ride} />)}</div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <h2 className="text-xl font-bold">No rides match yet</h2>
            <p className="mt-2 text-slate-600">Try a wider search or offer the first ride on this route.</p>
          </div>
        )}
      </main>
    </div>
  );
}
