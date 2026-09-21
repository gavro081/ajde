import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ client: {} }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../supabase/server", () => ({ createClient: async () => boundary.client }));

import { getRideComments } from "./queries";
import { deleteRideComment, postRideComment } from "./actions";

type Row = Record<string, unknown>;
const rideId = "11111111-1111-4111-8111-111111111111";
let userId: string | null;
let records: Record<string, Row[]>;
let failure: string | null;

function database(table: string) {
  const filters: Array<(row: Row) => boolean> = [];
  let insert: Row | undefined;
  let deleting = false;
  const execute = () => {
    if (failure === table) return { data: null, error: { message: "database unavailable" } };
    if (insert) records[table].push({ ...insert, id: crypto.randomUUID(), created_at: new Date().toISOString() });
    const rows = records[table].filter((row) => filters.every((filter) => filter(row)));
    if (deleting) records[table] = records[table].filter((row) => !rows.includes(row));
    return { data: rows.map((row) => table === "ride_comments" ? { ...row, author: records.profiles.find((profile) => profile.id === row.author_id) } : row), error: null };
  };
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
    order: () => query,
    insert: (row: Row) => { insert = row; return query; },
    delete: () => { deleting = true; return query; },
    maybeSingle: async () => { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
    then: (resolve: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
  };
  return query;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-21T10:00:00Z"));
  userId = "student";
  failure = null;
  records = {
    rides: [{ id: rideId, driver_id: "driver", status: "published", departure_at: "2026-09-21T11:00:00Z" }],
    profiles: ["student", "driver", "viewer"].map((id) => ({ id, full_name: id, photo_url: `https://example.com/${id}.jpg`, university: "University", phone: "PRIVATE" })),
    ride_comments: [],
  };
  boundary.client = { from: database, auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) } };
});

function form(body: string) { const data = new FormData(); data.set("body", body); return data; }
afterEach(() => vi.useRealTimers());

describe("ride Q&A actions and queries", () => {
  it.each(["", "   \n\t", "x".repeat(2001)])("rejects empty or oversized comments without changing the thread (case %#)", async (body) => {
    expect(await postRideComment(rideId, {}, form(body))).toEqual({ error: "Write a comment between 1 and 2000 characters." });
    expect(await getRideComments(rideId)).toMatchObject({ comments: [] });
  });
  it("only allows a comment's author to delete it, including when the viewer is the driver", async () => {
    await postRideComment(rideId, {}, form("Question"));
    const thread = await getRideComments(rideId);
    const commentId = thread.comments![0].id;
    expect(thread.comments![0].canDelete).toBe(true);
    userId = "driver";
    expect(await deleteRideComment(rideId, commentId)).toMatchObject({ error: expect.any(String) });
    expect((await getRideComments(rideId)).comments).toHaveLength(1);
    userId = "student";
    expect(await deleteRideComment(rideId, commentId)).toEqual({ success: "Comment deleted." });
    expect((await getRideComments(rideId)).comments).toEqual([]);
  });
  it("lets a student ask, a driver answer, and a third viewer read only public author details", async () => {
    expect(await postRideComment(rideId, {}, form("  Is there luggage space?  "))).toEqual({ success: "Comment posted." });
    userId = "driver";
    expect(await postRideComment(rideId, {}, form("Yes, one bag each."))).toEqual({ success: "Comment posted." });
    userId = "viewer";
    const result = await getRideComments(rideId);
    expect(result).toMatchObject({ canPost: true, comments: [
      { body: "Is there luggage space?", author: { full_name: "student", photo_url: "https://example.com/student.jpg" }, canDelete: false },
      { body: "Yes, one bag each.", author: { full_name: "driver" }, canDelete: false },
    ] });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });

  it("rejects anonymous reading, posting, and deletion", async () => {
    userId = null;
    expect(await getRideComments(rideId)).toMatchObject({ error: expect.stringContaining("Sign in") });
    expect(await postRideComment(rideId, {}, form("Question"))).toMatchObject({ error: expect.stringContaining("Sign in") });
    expect(await deleteRideComment(rideId, "comment")).toMatchObject({ error: expect.stringContaining("Sign in") });
  });

  it.each(["draft", "cancelled", "completed"])("restricts %s threads to their driver and refuses posts even from that driver", async (status) => {
    await postRideComment(rideId, {}, form("Existing question"));
    const commentId = (await getRideComments(rideId)).comments![0].id;
    records.rides[0].status = status;
    expect(await getRideComments(rideId)).toMatchObject({ error: expect.any(String) });
    expect(await postRideComment(rideId, {}, form("Forged question"))).toMatchObject({ error: expect.any(String) });
    expect(await deleteRideComment(rideId, commentId)).toMatchObject({ error: expect.any(String) });
    userId = "driver";
    expect(await getRideComments(rideId)).toMatchObject({ canPost: false, comments: [{ body: "Existing question" }] });
    expect(await postRideComment(rideId, {}, form("Forged answer"))).toMatchObject({ error: expect.stringContaining("closed") });
  });

  it.each(["published", "full"])("allows reading and posting on a future %s ride", async (status) => {
    records.rides[0].status = status;
    expect(await getRideComments(rideId)).toMatchObject({ canPost: true, comments: [] });
    expect(await postRideComment(rideId, {}, form("Question"))).toMatchObject({ success: expect.any(String) });
  });

  it.each(["2026-09-21T09:59:59Z", "2026-09-21T10:00:00Z"])("closes posts at or after departure (%s) while retaining visibility", async (departure) => {
    records.rides[0].departure_at = departure;
    expect(await getRideComments(rideId)).toMatchObject({ canPost: false, comments: [] });
    expect(await postRideComment(rideId, {}, form("Question"))).toMatchObject({ error: expect.stringContaining("closed") });
    userId = "driver";
    expect(await postRideComment(rideId, {}, form("Answer"))).toMatchObject({ error: expect.stringContaining("closed") });
  });

  it.each(["full_name", "photo_url", "university"])("requires the profile field %s before posting", async (field) => {
    records.profiles[0][field] = "  ";
    expect(await postRideComment(rideId, {}, form("Question"))).toMatchObject({ error: expect.stringContaining("profile") });
    expect(await getRideComments(rideId)).toMatchObject({ canPost: false, comments: [] });
  });

  it.each([1, 2000])("accepts %i characters after trimming", async (length) => {
    const body = "x".repeat(length);
    expect(await postRideComment(rideId, {}, form(`  ${body}  `))).toMatchObject({ success: expect.any(String) });
    expect((await getRideComments(rideId)).comments?.[0].body).toBe(body);
  });

  it("returns markup as literal text without adding author contact fields", async () => {
    const body = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    await postRideComment(rideId, {}, form(body));
    expect((await getRideComments(rideId)).comments?.[0]).toMatchObject({ body, author: { full_name: "student", photo_url: "https://example.com/student.jpg" } });
  });

  it("allows authors to withdraw comments after departure or an incomplete profile", async () => {
    await postRideComment(rideId, {}, form("Withdraw this"));
    const commentId = (await getRideComments(rideId)).comments![0].id;
    records.rides[0].departure_at = "2026-09-21T09:00:00Z";
    records.profiles = records.profiles.filter((profile) => profile.id !== "student");
    expect(await deleteRideComment(rideId, commentId)).toMatchObject({ success: expect.any(String) });
    expect((await getRideComments(rideId)).comments).toEqual([]);
  });

  it("refuses deleting a comment through a different ride", async () => {
    await postRideComment(rideId, {}, form("Question"));
    const commentId = (await getRideComments(rideId)).comments![0].id;
    records.rides.push({ ...records.rides[0], id: "another-ride" });
    expect(await deleteRideComment("another-ride", commentId)).toMatchObject({ error: expect.any(String) });
    expect((await getRideComments(rideId)).comments).toHaveLength(1);
  });

  it("reports comment storage failures instead of returning an empty thread or successful write", async () => {
    failure = "ride_comments";
    expect(await getRideComments(rideId)).toMatchObject({ error: expect.stringContaining("load") });
    expect(await postRideComment(rideId, {}, form("Question"))).toMatchObject({ error: expect.stringContaining("posted") });
    expect(await deleteRideComment(rideId, "comment")).toMatchObject({ error: expect.stringContaining("deleted") });
  });

  it("fails closed for missing rides, failed ride reads, and missing profiles", async () => {
    expect(await getRideComments("missing")).toMatchObject({ error: expect.any(String) });
    failure = "rides";
    expect(await postRideComment(rideId, {}, form("Question"))).toMatchObject({ error: expect.any(String) });
    failure = null;
    records.profiles = [];
    expect(await postRideComment(rideId, {}, form("Question"))).toMatchObject({ error: expect.stringContaining("profile") });
  });
});
