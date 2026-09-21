import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { NaturalLanguageSearch } from "@/components/discovery/natural-language-search";
import { RideResults } from "@/components/discovery/ride-results";
import { SearchInterpretation } from "@/components/discovery/search-interpretation";
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
  const rawParams = await searchParams;
  const returnParams = serializeParams(rawParams);
  const user = await requireCompleteProfile(returnParams ? `/rides?${returnParams}` : "/rides");
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
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
        {firstParam(rawParams.welcome) === "1" ? <p role="status" className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Your profile is ready. Welcome aboard — find your first ride below.</p> : null}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="page-heading">Find a ride</h1>
            <p className="mt-4 text-slate-500">A seat, some company, and a way home.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/rides/new" className="btn-primary">Offer a ride</Link>
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

        <details className="filter-options" open={Boolean(filters.origin || filters.destination || filters.date || filters.sameGenderOnly || filters.seats > 1 || firstParam(rawParams.manual))}>
        <summary>Filter by city, date or seats</summary>
        <form aria-label="Filter rides" className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {naturalQuery ? <input type="hidden" name="q" value={naturalQuery} /> : null}
          {firstParam(rawParams.search) === "1" ? <input type="hidden" name="search" value="1" /> : null}
          {firstParam(rawParams.interpretation) ? (
            <input type="hidden" name="interpretation" value={firstParam(rawParams.interpretation)} />
          ) : null}
          <label className="text-sm font-semibold text-slate-600">From
            <select name="origin" defaultValue={filters.origin ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal text-slate-950">
              <option value="">Anywhere</option>
              {cities?.map((city) => <option key={city.id} value={city.id}>{city.name_en}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-600">To
            <select name="destination" defaultValue={filters.destination ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal text-slate-950">
              <option value="">Anywhere</option>
              {cities?.map((city) => <option key={city.id} value={city.id}>{city.name_en}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-600">Date
            <input name="date" type="date" defaultValue={filters.date ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal text-slate-950" />
          </label>
          <label className="text-sm font-semibold text-slate-600">Seats
            <select name="seats" defaultValue={filters.seats} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal text-slate-950">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>{value}+</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end rounded-xl px-1 py-2.5 text-sm font-semibold text-slate-600 lg:col-span-2">
            <input
              name="sameGender"
              type="checkbox"
              value="1"
              defaultChecked={filters.sameGenderOnly}
              className="size-4 accent-emerald-700"
            />
            Same-gender drivers
          </label>
          <div className="flex flex-wrap items-center justify-end gap-3 self-end lg:col-span-2"><Link href="/rides" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-slate-600 hover:text-slate-950">Reset</Link><button name="manual" value="1" className="btn-primary" type="submit">Apply filters</button></div>
        </form>
        </details>

        {genderUnavailable ? (
          <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            This filter needs a declared gender on your profile. Your profile does not have one, so all drivers are shown.
          </p>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          <div><h2 className="text-2xl font-normal tracking-tight">Your next ride</h2><p className="mt-1 text-sm text-slate-500">{rides.length} matching ride{rides.length === 1 ? "" : "s"} · Soonest departures first</p></div>
        </div>
        {rides.length ? (
          <RideResults rides={rides} searchContext={interpretation} />
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
            <h2 className="text-xl font-bold">No rides match yet</h2>
            <p className="mt-2 text-slate-600">Try a wider search or offer the first ride on this route.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/rides" className="btn-secondary">Show all rides</Link><Link href="/rides/new" className="btn-primary">Offer a ride</Link></div>
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
