import {
  searchQueryResultSchema,
  type SearchQueryResult,
} from "../ai/search-query-schema";

import { localDayUtcBounds } from "./skopje-time";

export const DISCOVERY_TIME_ZONE = "Europe/Skopje";

export type RideFilters = {
  origin: number | null;
  destination: number | null;
  date: string | null;
  departureAfter: string | null;
  departureBefore: string | null;
  sameGenderOnly: boolean;
};

export type DepartureBounds = {
  after: string;
  before: string | null;
};

type SearchValue = string | string[] | undefined;

function first(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInteger(value: SearchValue) {
  const parsed = Number(first(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseRideFilters(params: Record<string, SearchValue>): RideFilters {
  const date = localDate(params.date);
  let departureAfter = instant(params.after);
  let departureBefore = instant(params.before);

  if (
    departureAfter &&
    departureBefore &&
    Date.parse(departureAfter) >= Date.parse(departureBefore)
  ) {
    departureAfter = null;
    departureBefore = null;
  }

  return {
    origin: positiveInteger(params.origin),
    destination: positiveInteger(params.destination),
    date,
    departureAfter,
    departureBefore,
    sameGenderOnly: boolean(params.sameGender),
  };
}

function localDate(value: SearchValue) {
  const candidate = first(value);
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;
  const [year, month, day] = candidate.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
    ? candidate
    : null;
}

function instant(value: SearchValue) {
  const candidate = first(value);
  if (!candidate || !/^\d{4}-\d{2}-\d{2}T/.test(candidate)) return null;
  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function boolean(value: SearchValue) {
  const candidate = first(value)?.toLocaleLowerCase("en-US");
  return candidate === "1" || candidate === "true" || candidate === "on";
}

export function departureBoundsForFilters(
  filters: RideFilters,
  now = new Date(),
): DepartureBounds {
  const nowMs = now.getTime();
  let requestedAfter = filters.departureAfter;
  let requestedBefore = filters.departureBefore;

  // A manually selected calendar date takes precedence over AI-produced bounds.
  // Without any date, every upcoming departure matches.
  if (filters.date) {
    const day = localDayUtcBounds(filters.date, DISCOVERY_TIME_ZONE);
    requestedAfter = day.start;
    requestedBefore = day.end;
  }

  const afterMs = requestedAfter ? Date.parse(requestedAfter) : nowMs;
  return {
    after: new Date(Math.max(nowMs, afterMs)).toISOString(),
    before: requestedBefore,
  };
}

// "seats" is legacy (bookings are always one seat) but still stripped from old URLs.
const REPLACED_BY_SEARCH = ["origin", "destination", "date", "seats", "after", "before"];
const SEARCH_STATE = ["q", "search", "interpretation", "manual"];

export function searchResultParams(
  current: URLSearchParams,
  query: string,
  result: SearchQueryResult,
) {
  const next = new URLSearchParams(current);
  for (const key of [...REPLACED_BY_SEARCH, ...SEARCH_STATE]) next.delete(key);

  const normalizedQuery = query.trim();
  if (normalizedQuery) next.set("q", normalizedQuery);
  next.set("search", "1");
  if (result.originId !== null) next.set("origin", String(result.originId));
  if (result.destinationId !== null) next.set("destination", String(result.destinationId));
  if (result.departureAfter !== null) next.set("after", result.departureAfter);
  if (result.departureBefore !== null) next.set("before", result.departureBefore);
  next.set("interpretation", JSON.stringify(result));
  return next;
}

export function manualFilterParams(
  current: URLSearchParams,
  manual: Pick<RideFilters, "origin" | "destination" | "date" | "sameGenderOnly">,
) {
  const next = new URLSearchParams(current);
  for (const key of REPLACED_BY_SEARCH) {
    next.delete(key);
  }

  if (manual.origin !== null) next.set("origin", String(manual.origin));
  if (manual.destination !== null) next.set("destination", String(manual.destination));
  if (manual.date !== null) next.set("date", manual.date);
  if (manual.sameGenderOnly) next.set("sameGender", "1");
  else next.delete("sameGender");
  return next;
}

export function clearSearchParams(current: URLSearchParams) {
  const next = new URLSearchParams(current);
  for (const key of [...REPLACED_BY_SEARCH, ...SEARCH_STATE]) next.delete(key);
  return next;
}

export function decodeSearchInterpretation(value: SearchValue): SearchQueryResult | null {
  const encoded = first(value);
  if (!encoded || encoded.length > 4_000) return null;

  try {
    const parsed: unknown = JSON.parse(encoded);
    const result = searchQueryResultSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
