"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { searchQueryResultSchema } from "@/lib/ai/search-query-schema";
import { clearSearchParams, searchResultParams } from "@/lib/rides/ride-filters";

export function NaturalLanguageSearch({
  currentParams,
  initialQuery,
}: {
  currentParams: string;
  initialQuery: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2) {
      setError("Describe the ride you need in at least two characters.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: normalized }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setError(readError(payload) ?? "AI search is unavailable. Use the manual filters below.");
        return;
      }

      const result = searchQueryResultSchema.safeParse(
        typeof payload === "object" && payload !== null && "result" in payload
          ? payload.result
          : null,
      );
      if (!result.success) {
        setError("The search interpretation was invalid. Use the manual filters below.");
        return;
      }

      const params = searchResultParams(new URLSearchParams(currentParams), normalized, result.data);
      router.push(`/rides?${params.toString()}`);
    } catch {
      setError("AI search could not be reached. Use the manual filters below.");
    } finally {
      setPending(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setError("");
    const params = clearSearchParams(new URLSearchParams(currentParams));
    router.push(params.size ? `/rides?${params.toString()}` : "/rides");
  }

  return (
    <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-emerald-950">Search in your own words</h2>
        <p className="text-sm text-emerald-900/75">
          Try “Bitola Friday after 4” or “до Штип утре за 2 места”. You can correct the result below.
        </p>
      </div>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
        <label className="sr-only" htmlFor="natural-search">Describe the ride you need</label>
        <input
          id="natural-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={300}
          placeholder="Where and when do you want to travel?"
          className="min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? "Interpreting…" : "Search"}
        </button>
        {initialQuery ? (
          <button
            type="button"
            onClick={clearSearch}
            className="rounded-xl border border-emerald-300 bg-white px-4 py-3 font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            Clear search
          </button>
        ) : null}
      </form>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-white px-4 py-3 text-sm text-rose-800">{error}</p> : null}
    </section>
  );
}

function readError(payload: unknown) {
  return typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
    ? payload.error
    : null;
}
