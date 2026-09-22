import { expect, it, vi } from "vitest";
import { findSimilarRides, type SimilarRidesClient } from "./similar-rides-tool";

vi.mock("server-only", () => ({}));
const args = { originCityId: 1, destinationCityId: 2, departureAt: "2026-09-22T14:00:00Z" };
const row = { id: "20000000-0000-4000-8000-000000000001", origin_city_id: 1, dest_city_id: 2, status: "published", departure_at: args.departureAt, price_per_seat_mkd: 150, seats_available: 2 };
function database(rows: Record<string, unknown>[], options: { error?: boolean; ignoreFilters?: boolean } = {}) {
  const filters: ((row: Record<string, unknown>) => boolean)[] = [];
  const orders: string[] = [];
  let limit = Infinity;
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
    in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
    gte: (key: string, value: string) => { filters.push(row => Date.parse(String(row[key])) >= Date.parse(value)); return query; },
    lte: (key: string, value: string) => { filters.push(row => Date.parse(String(row[key])) <= Date.parse(value)); return query; },
    order: (key: string) => { orders.push(key); return query; },
    limit: (value: number) => { limit = value; return query; },
    then: <TResult1 = { data: unknown; error: unknown }, TResult2 = never>(resolve?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null, reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) => Promise.resolve({
      data: options.ignoreFilters ? rows : rows.filter(row => filters.every(matches => matches(row))).sort((a, b) => { for (const key of orders) { const comparison = String(a[key]).localeCompare(String(b[key])); if (comparison) return comparison; } return 0; }).slice(0, limit),
      error: options.error ? { message: "policy or database unavailable" } : null,
    }).then(resolve, reject),
  };
  const from = vi.fn(() => query);
  // This fake implements only the database operations exercised by the public executor.
  const client = { from } as unknown as SimilarRidesClient;
  return { client, from };
}

it("queries both inclusive time boundaries, excludes other routes/statuses/times, and exposes only public evidence", async () => {
  const lower = { ...row, departure_at: "2026-09-22T11:00:00Z" };
  const upper = { ...row, id: "20000000-0000-4000-8000-000000000002", departure_at: "2026-09-22T17:00:00Z", status: "full", seats_available: 0 };
  const { client, from } = database([upper, lower,
    { ...row, departure_at: "2026-09-22T10:59:59Z" }, { ...row, departure_at: "2026-09-22T17:00:01Z" },
    { ...row, origin_city_id: 2, dest_city_id: 1 }, { ...row, dest_city_id: 3 },
    ...["draft", "cancelled", "completed"].map(status => ({ ...row, status })),
  ]);
  expect(await findSimilarRides(client, args)).toEqual({ rides: [
    { id: lower.id, departureAt: lower.departure_at, pricePerSeatMkd: 150, seatsAvailable: 2 },
    { id: upper.id, departureAt: upper.departure_at, pricePerSeatMkd: 150, seatsAvailable: 0 },
  ] });
  expect(from).toHaveBeenCalledWith("rides");
});

it("returns at most five matches in deterministic departure and ID order", async () => {
  const rows = Array.from({ length: 7 }, (_, index) => ({ ...row, id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` })).reverse();
  const result = await findSimilarRides(database(rows).client, args);
  expect(result).toHaveProperty("rides");
  if ("rides" in result) expect(result.rides.map(ride => ride.id)).toEqual([...rows].reverse().slice(0, 5).map(row => row.id));
});

it("distinguishes a successful empty search from a failed query", async () => {
  expect(await findSimilarRides(database([]).client, args)).toEqual({ rides: [] });
  expect(await findSimilarRides(database([row], { error: true }).client, args)).toEqual({ error: "Similar-ride search unavailable." });
});

it.each([
  { originCityId: 1, destinationCityId: 1 }, { originCityId: 0 }, { departureAt: "not a date" }, { departureAt: "2026-09-22T14:00:00" },
])("rejects invalid search input before database access: %j", async change => {
  const db = database([row]);
  expect(await findSimilarRides(db.client, { ...args, ...change })).toHaveProperty("error");
  expect(db.from).not.toHaveBeenCalled();
});

it.each([
  { origin_city_id: 2, dest_city_id: 1 }, { dest_city_id: 3 }, { status: "draft" },
  { departure_at: "2026-09-22T10:59:59Z" }, { departure_at: "2026-09-22T17:00:01Z" },
  { id: "not-a-uuid" }, { seats_available: -1 }, { price_per_seat_mkd: -10 }, { departure_at: "tomorrow" },
])("does not trust malformed or unrelated rows returned by the database: %j", async change => {
  expect(await findSimilarRides(database([{ ...row, ...change }], { ignoreFilters: true }).client, args)).toEqual({ error: "Similar-ride search returned invalid evidence." });
});

it("rejects an unexpectedly oversized result instead of persisting excess evidence", async () => {
  expect(await findSimilarRides(database(Array.from({ length: 6 }, () => row), { ignoreFilters: true }).client, args)).toHaveProperty("error");
});

it("contains database exceptions without leaking private failure details", async () => {
  expect(await findSimilarRides({ from: () => { throw new Error("private credentials"); } }, args)).toEqual({ error: "Similar-ride search unavailable." });
});
