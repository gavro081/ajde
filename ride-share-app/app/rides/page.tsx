import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { NaturalLanguageSearch } from "@/components/discovery/natural-language-search";
import { SearchInterpretation } from "@/components/discovery/search-interpretation";
import { RideCard } from "@/components/ride-card";
import { requireCompleteProfile } from "@/lib/auth/session";
import { usableDiscoveryGender } from "@/lib/rides/gender-discovery";
import { decodeSearchInterpretation, parseRideFilters } from "@/lib/rides/ride-filters";
import { getRideFeed } from "@/lib/rides/ride-view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Find a ride" };

type RideFeedPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RideFeedPage({ searchParams }: RideFeedPageProps) {
  const user = await requireCompleteProfile("/rides");
  const rawParams = await searchParams;
  const filters = parseRideFilters(rawParams);
  const interpretation = decodeSearchInterpretation(rawParams.interpretation);
  const naturalQuery = firstParam(rawParams.q)?.slice(0, 300) ?? "";
  const currentParams = serializeParams(rawParams);
  const supabase = await createClient();
  const [{ data: cities, error }, { data: passengerProfile, error: profileError }] = await Promise.all([
    supabase.from("cities").select("id, name_en, name_mk").order("name_en"),
    supabase.from("profiles").select("gender").eq("id", user.id).maybeSingle(),
  ]);
  if (error || profileError) throw new Error("Unable to load discovery filters.");

  const passengerGender = usableDiscoveryGender(passengerProfile?.gender);
  const rides = await getRideFeed(filters, { passengerGender });
  const genderUnavailable = filters.sameGenderOnly && !passengerGender;
  const cityNames = new Map((cities ?? []).map((city) => [city.id, city.name_en]));

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

        <NaturalLanguageSearch key={naturalQuery} currentParams={currentParams} initialQuery={naturalQuery} />
        {interpretation ? (
          <SearchInterpretation
            result={interpretation}
            cityNames={cityNames}
            manualOverride={firstParam(rawParams.manual) === "1"}
          />
        ) : null}

        <form className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
          {naturalQuery ? <input type="hidden" name="q" value={naturalQuery} /> : null}
          {firstParam(rawParams.search) === "1" ? <input type="hidden" name="search" value="1" /> : null}
          {firstParam(rawParams.interpretation) ? (
            <input type="hidden" name="interpretation" value={firstParam(rawParams.interpretation)} />
          ) : null}
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
          <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700">
            <input
              name="sameGender"
              type="checkbox"
              value="1"
              defaultChecked={filters.sameGenderOnly}
              className="size-4 accent-emerald-700"
            />
            Same-gender drivers
          </label>
          <button name="manual" value="1" className="self-end rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700" type="submit">Apply filters</button>
        </form>

        {genderUnavailable ? (
          <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Add a declared gender to your profile to use this discovery filter. No gender-based filtering was applied.
          </p>
        ) : null}

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

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function serializeParams(params: Record<string, string | string[] | undefined>) {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => result.append(key, item));
    else if (value !== undefined) result.set(key, value);
  }
  return result.toString();
}
