export type RideFilters = {
  origin: number | null;
  destination: number | null;
  date: string | null;
  seats: number;
};

type SearchValue = string | string[] | undefined;

function first(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInteger(value: SearchValue, fallback: number, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(first(value));
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

export function parseRideFilters(params: Record<string, SearchValue>): RideFilters {
  const date = first(params.date);
  return {
    origin: positiveInteger(params.origin, 0) || null,
    destination: positiveInteger(params.destination, 0) || null,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    seats: positiveInteger(params.seats, 1, 8),
  };
}
