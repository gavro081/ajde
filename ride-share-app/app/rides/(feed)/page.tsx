import type { Metadata } from "next";
import Link from "next/link";

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
    <div className="text-slate-950">
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
        {firstParam(rawParams.welcome) === "1" ? <p role="status" className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Your profile is ready. Welcome aboard — find your first ride below.</p> : null}
        <div>
          <h1 className="page-heading">Find a ride</h1>
          <p className="mt-4 text-slate-500">A seat, some company, and a way home.</p>
        </div>

        <NaturalLanguageSearch key={naturalQuery} currentParams={currentParams} initialQuery={naturalQuery} />
        {interpretation ? (
          <SearchInterpretation
            result={interpretation}
            cityNames={cityNames}
            manualOverride={firstParam(rawParams.manual) === "1"}
          />
        ) : null}

        <details className="filter-options" open={Boolean(filters.origin || filters.destination || filters.date || filters.dateTo || filters.timeAfter || filters.timeBefore || filters.sameGenderOnly || firstParam(rawParams.manual))}>
        <summary>Filter by city, date or time</summary>
        <form key={currentParams} aria-label="Filter rides" className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
          <label className="text-sm font-semibold text-slate-600">From date <span className="font-normal text-slate-500">(optional)</span>
            <input name="date" type="date" defaultValue={filters.date ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal text-slate-950" />
          </label>
          <label className="text-sm font-semibold text-slate-600">Through date <span className="font-normal text-slate-500">(optional)</span>
            <input name="dateTo" type="date" defaultValue={filters.dateTo ?? ""} min={filters.date ?? undefined} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal text-slate-950" />
          </label>
          <label className="text-sm font-semibold text-slate-600">At or after <span className="font-normal text-slate-500">(optional)</span>
            <input name="timeAfter" type="time" defaultValue={filters.timeAfter ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal text-slate-950" />
          </label>
          <label className="text-sm font-semibold text-slate-600">Before <span className="font-normal text-slate-500">(optional)</span>
            <input name="timeBefore" type="time" defaultValue={filters.timeBefore ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal text-slate-950" />
          </label>
          <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">Dates are optional. A from date alone selects one day; a through date includes that day. Times apply every day in Skopje time. If the end time is earlier, the window crosses midnight.</p>
          <label className="flex items-center gap-2 self-end rounded-xl px-1 py-2.5 text-sm font-semibold text-slate-600">
            <input
              name="sameGender"
              type="checkbox"
              value="1"
              defaultChecked={filters.sameGenderOnly}
              className="size-4 accent-emerald-700"
            />
            Same-gender drivers
          </label>
          <div className="flex flex-wrap items-center justify-end gap-3 self-end sm:col-span-2"><Link href="/rides" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-slate-600 hover:text-slate-950">Reset</Link><button name="manual" value="1" className="btn-primary" type="submit">Apply filters</button></div>
        </form>
        </details>

        {genderUnavailable ? (
          <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            This filter needs a declared gender on your profile. Your profile does not have one, so all drivers are shown.
          </p>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          <div><h2 className="font-display text-2xl font-bold tracking-[-.03em]">Your next ride</h2><p className="mt-1 text-sm text-slate-500">{rides.length} matching ride{rides.length === 1 ? "" : "s"} · Soonest departures first</p></div>
        </div>
        {rides.length ? (
          <RideResults rides={rides} searchContext={interpretation} />
        ) : (
          <div className="mt-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
            <h2 className="font-display text-2xl font-bold tracking-[-.03em]">No rides match yet</h2>
            <p className="mt-2 text-slate-600">Try a wider search, or leave the date empty to see every upcoming ride.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/rides" className="btn-primary">Show all rides</Link></div>
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
