import { beforeEach, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  userId: "20000000-0000-4000-8000-000000000002" as string | null,
  ride: { id: "40000000-0000-4000-8000-000000000001", driver_id: "20000000-0000-4000-8000-000000000001", status: "completed" },
  bookings: [{ ride_id: "40000000-0000-4000-8000-000000000001", passenger_id: "20000000-0000-4000-8000-000000000002", status: "accepted", seats: 2 }],
  ratings: [] as Record<string, unknown>[],
  readError: "",
  insertError: "",
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: db.userId ? { id: db.userId } : null }, error: null }) },
  from: (table: string) => {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let inserted: Record<string, unknown> | undefined;
    const execute = () => {
      if (inserted) {
        if (db.insertError) return { data: null, error: { code: db.insertError } };
        db.ratings.push(inserted);
        return { data: [inserted], error: null };
      }
      if (db.readError === table) return { data: null, error: { code: "database_failure" } };
      const rows = table === "rides" ? [db.ride] : table === "bookings" ? db.bookings : db.ratings;
      return { data: rows.filter((row) => filters.every((matches) => matches(row))), error: null };
    };
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return query; },
      insert: (row: Record<string, unknown>) => { inserted = row; return query; },
      maybeSingle: async () => { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
      then: (resolve: (result: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
    };
    return query;
  },
}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import { submitRating } from "./actions";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ rideId: db.ride.id, rateeId: db.ride.driver_id, score: "4", note: "  Thoughtful driver  ", ...overrides })) data.set(key, value);
  return data;
}
beforeEach(() => {
  db.userId = "20000000-0000-4000-8000-000000000002";
  db.ride.status = "completed";
  db.bookings[0].status = "accepted";
  db.ratings = [];
  db.readError = "";
  db.insertError = "";
  vi.clearAllMocks();
});

it("persists a rating with session identity and refreshes dashboards and the profile", async () => {
  expect(await submitRating(null, form({ rater_id: "forged" }))).toMatchObject({ status: "submitted", rating: { score: 4, note: "Thoughtful driver" } });
  expect(db.ratings).toEqual([{ ride_id: db.ride.id, rater_id: db.userId, ratee_id: db.ride.driver_id, score: 4, note: "Thoughtful driver" }]);
  expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toEqual(["/dashboard/trips", "/dashboard/driver", `/profile/${db.ride.driver_id}`]);
  expect(db.ride.status).toBe("completed");
  expect(db.bookings[0]).toMatchObject({ status: "accepted", seats: 2 });
});

it("allows the reverse direction without changing bookings or the ride", async () => {
  db.userId = db.ride.driver_id;
  expect(await submitRating(null, form({ rateeId: db.bookings[0].passenger_id }))).toMatchObject({ status: "submitted" });
  expect(db.bookings[0].seats).toBe(2);
  expect(db.ride.status).toBe("completed");
});
it("returns the same harmless result for retries and racing unique violations", async () => {
  await submitRating(null, form());
  expect(await submitRating(null, form())).toMatchObject({ status: "already_rated" });
  expect(db.ratings).toHaveLength(1);
  db.ratings = [];
  db.insertError = "23505";
  expect(await submitRating(null, form())).toMatchObject({ status: "already_rated" });
});
it.each(["rides", "bookings", "ratings"])("fails closed when reading %s fails", async (table) => {
  db.readError = table;
  expect(await submitRating(null, form())).toMatchObject({ status: "error" });
  expect(db.ratings).toHaveLength(0);
  expect(revalidatePath).not.toHaveBeenCalled();
});
it("does not report success or refresh data after a failed insert", async () => {
  db.insertError = "42501";
  expect(await submitRating(null, form())).toMatchObject({ status: "error" });
  expect(db.ratings).toHaveLength(0);
  expect(revalidatePath).not.toHaveBeenCalled();
});
it("rejects unauthenticated and unrelated users even with forged state", async () => {
  for (const userId of [null, "20000000-0000-4000-8000-000000000009"]) {
    db.userId = userId;
    expect(await submitRating({ status: "already_rated", message: "forged" }, form({ role: "driver", status: "completed" }))).toMatchObject({ status: "error" });
  }
  expect(db.ratings).toHaveLength(0);
});
it("rejects forged targets and ride IDs, non-completed rides and cancelled bookings", async () => {
  expect(await submitRating(null, form({ rateeId: "20000000-0000-4000-8000-000000000009" }))).toMatchObject({ status: "error" });
  expect(await submitRating(null, form({ rideId: "40000000-0000-4000-8000-000000000009" }))).toMatchObject({ status: "error" });
  for (const status of ["draft", "published", "full", "cancelled"]) {
    db.ride.status = status;
    expect(await submitRating(null, form())).toMatchObject({ status: "error" });
  }
  db.ride.status = "completed";
  db.bookings[0].status = "cancelled";
  expect(await submitRating(null, form())).toMatchObject({ status: "error" });
  expect(db.ratings).toHaveLength(0);
});
it("rejects invalid form values before writing", async () => {
  for (const score of ["", "0", "6", "2.5", "nope"]) {
    expect(await submitRating(null, form({ score }))).toMatchObject({ status: "error" });
  }
  expect(await submitRating(null, form({ note: "x".repeat(1001) }))).toMatchObject({ status: "error" });
  expect(db.ratings).toHaveLength(0);
});
