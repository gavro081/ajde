import "server-only";
import { z } from "zod";
import { findSimilarRidesArgsSchema, findSimilarRidesResultSchema, type FindSimilarRidesArgs, type FindSimilarRidesResult } from "./ride-check-contract";
import type { createClient } from "@/lib/supabase/server";

export type SimilarRidesClient = Pick<Awaited<ReturnType<typeof createClient>>, "from">;
const rowSchema = z.object({
  id: z.uuid(), origin_city_id: z.number().int(), dest_city_id: z.number().int(),
  status: z.enum(["published", "full"]), departure_at: z.iso.datetime({ offset: true }),
  price_per_seat_mkd: z.number().finite().nonnegative().nullable(), seats_available: z.number().int().min(0).max(8),
});

/** Only the caller's session-bound client is used; database access policies remain authoritative. */
export async function findSimilarRides(client: SimilarRidesClient, input: FindSimilarRidesArgs): Promise<FindSimilarRidesResult | { error: string }> {
  const parsed = findSimilarRidesArgsSchema.safeParse(input);
  if (!parsed.success || parsed.data.originCityId === parsed.data.destinationCityId) return { error: "Invalid similar-ride search arguments." };
  const args = parsed.data;
  const departure = Date.parse(args.departureAt);
  const window = 3 * 60 * 60 * 1000;
  try {
    const { data, error } = await client.from("rides")
      .select("id, origin_city_id, dest_city_id, status, departure_at, price_per_seat_mkd, seats_available")
      .eq("origin_city_id", args.originCityId).eq("dest_city_id", args.destinationCityId)
      .in("status", ["published", "full"])
      .gte("departure_at", new Date(departure - window).toISOString())
      .lte("departure_at", new Date(departure + window).toISOString())
      .order("departure_at", { ascending: true }).order("id", { ascending: true }).limit(5);
    if (error) return { error: "Similar-ride search unavailable." };
    const rows = z.array(rowSchema).max(5).safeParse(data);
    if (!rows.success || rows.data.some(row => row.origin_city_id !== args.originCityId || row.dest_city_id !== args.destinationCityId || Math.abs(Date.parse(row.departure_at) - departure) > window)) return { error: "Similar-ride search returned invalid evidence." };
    return findSimilarRidesResultSchema.parse({ rides: rows.data.map(row => ({ id: row.id, departureAt: row.departure_at, pricePerSeatMkd: row.price_per_seat_mkd, seatsAvailable: row.seats_available })) });
  } catch {
    return { error: "Similar-ride search unavailable." };
  }
}
