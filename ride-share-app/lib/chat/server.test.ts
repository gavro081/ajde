import { beforeEach, describe, expect, it, vi } from "vitest";
import { compareMessages } from "./contract";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, user: "", fail: "", writes: [] as Row[], reads: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("../auth/email-domain", () => ({ isAllowedStudentEmail: () => true }));
vi.mock("../supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: db.user ? { id: db.user, email: "student@example.com" } : null } }) },
  from: (table: string) => {
    let rows = [...(db.tables[table] ?? [])]; let limit = Infinity; let ascending = true;
    const chain = {
      select(columns: string) { db.reads.push(columns); return chain; },
      eq(key: string, value: unknown) { rows = rows.filter(r => r[key] === value); return chain; },
      is(key: string, value: unknown) { return chain.eq(key, value); },
      in(key: string, values: unknown[]) { rows = rows.filter(r => values.includes(r[key])); return chain; },
      gte(key: string, value: string) { rows = rows.filter(r => Date.parse(String(r[key])) >= Date.parse(value)); return chain; },
      or(filter: string) {
        const m = filter.match(/^created_at\.(lt|gt)\.(.+),and\(created_at\.eq\.(.+),id\.(lt|gt)\.(.+)\)$/)!;
        rows = rows.filter(r => { const c = compareMessages(r as { id: string; created_at: string }, { id: m[5], created_at: m[2] }); return m[1] === "lt" ? c < 0 : c > 0; });
        return chain;
      },
      order(_key: string, options: { ascending: boolean }) { ascending = options.ascending; return chain; },
      limit(value: number) { limit = value; return chain; },
      insert(row: Row) { db.writes.push(row); rows = [{ ...row, id: uuid(999), created_at: new Date().toISOString() }]; return chain; },
      maybeSingle: async () => ({ data: rows[0] ?? null, error: db.fail === table ? { code: "database" } : null }),
      single: async () => ({ data: rows[0] ?? null, error: db.fail === table ? { code: "database" } : null }),
      then(resolve: (value: unknown) => unknown) {
        if (table === "messages") rows.sort((a, b) => compareMessages(a as { id: string; created_at: string }, b as { id: string; created_at: string }) * (ascending ? 1 : -1));
        return Promise.resolve({ data: rows.slice(0, limit), error: db.fail === table ? { code: "database" } : null }).then(resolve);
      },
    }; return chain;
  },
}) }));
import { insertRoomMessage, queryRoom } from "./server";
function uuid(n: number) { return `92000000-0000-4000-8000-${String(n).padStart(12, "0")}`; }
const rideId = uuid(1);
beforeEach(() => {
  db.user = "passenger"; db.fail = ""; db.writes = []; db.reads = [];
  db.tables = {
    rides: [{ id: rideId, driver_id: "driver", status: "published", departure_at: "2099-09-21T12:00:00Z" }],
    bookings: [{ ride_id: rideId, passenger_id: "passenger", status: "accepted", decided_at: "2026-09-21T12:00:00Z" }],
    profiles: ["driver", "passenger", "former"].map(id => ({ id, full_name: id, photo_url: "/photo.png", university: "UKIM", phone: "+38970123456", social_url: "https://x.com/" + id, instagram: null, facebook: null })),
    messages: Array.from({ length: 105 }, (_, n) => ({ id: uuid(n + 10), ride_id: rideId, sender_id: "former", recipient_id: null, body: String(n), created_at: "2026-09-21T12:00:00Z" })),
  };
});
describe("room history and mutations", () => {
  it("paginates more than 50 identical timestamps without omissions or duplicates", async () => {
    const first = await queryRoom({ rideId }); expect(first.ok).toBe(true); if (!first.ok) return;
    expect(first.value.messages).toHaveLength(50);
    const second = await queryRoom({ rideId, cursor: first.value.nextCursor }); if (!second.ok) throw new Error(second.error);
    const third = await queryRoom({ rideId, cursor: second.value.nextCursor }); if (!third.ok) throw new Error(third.error);
    expect([...third.value.messages, ...second.value.messages, ...first.value.messages].map(m => m.body)).toEqual(Array.from({ length: 105 }, (_, n) => String(n)));
    expect(third.value.nextCursor).toBeNull();
    expect(first.value.members.map(m => m.id)).toEqual(["driver", "passenger"]);
    expect(first.value.messages[0].sender?.full_name).toBe("former");
    expect(first.value.members[0].phone).toBe("+38970123456");
    expect(first.value.members[0].social_url).toBe("https://x.com/driver");
    expect(first.value.members.some(m => m.id === "former")).toBe(false);
    expect(first.value.messages[0].sender).not.toHaveProperty("phone");
    expect(first.value.messages[0].sender).not.toHaveProperty("social_url");
  });
  it("supports forward catch-up after more than 50 missed messages", async () => {
    const result = await queryRoom({ rideId, direction: "newer", cursor: { id: uuid(10), created_at: "2026-09-21T12:00:00Z" } });
    expect(result.ok && result.value.messages[0].body).toBe("1");
    expect(result.ok && result.value.nextCursor?.id).toBe(uuid(60));
  });
  it("excludes pre-acceptance history, other rides, and legacy direct messages", async () => {
    db.tables.messages.push({ ...db.tables.messages[0], id: uuid(200), created_at: "2026-09-21T11:59:59Z" },
      { ...db.tables.messages[0], id: uuid(201), ride_id: uuid(2) }, { ...db.tables.messages[0], id: uuid(202), recipient_id: "driver" });
    const result = await queryRoom({ rideId });
    expect(result.ok && result.value.messages.every(m => ![uuid(200), uuid(201), uuid(202)].includes(m.id))).toBe(true);
  });
  it.each(["", "unrelated"])("refuses history and sends for %s", async user => {
    db.user = user;
    expect(await queryRoom({ rideId })).toMatchObject({ ok: false, code: "unavailable" });
    expect(await insertRoomMessage({ rideId, body: "Hi" })).toMatchObject({ ok: false });
    expect(db.writes).toHaveLength(0);
  });
  it("rechecks membership after a passenger cancels while the room is open", async () => {
    expect((await queryRoom({ rideId })).ok).toBe(true);
    db.tables.bookings[0].status = "cancelled";
    expect((await queryRoom({ rideId })).ok).toBe(false);
    expect((await insertRoomMessage({ rideId, body: "Hi" })).ok).toBe(false);
  });
  it("derives the sender and inserts exactly one shared message", async () => {
    const result = await insertRoomMessage({ rideId, body: " Hi " });
    expect(result.ok).toBe(true);
    expect(db.writes).toEqual([{ ride_id: rideId, sender_id: "passenger", recipient_id: null, body: "Hi" }]);
  });
  it.each(["rides", "bookings", "profiles", "messages"])("reports %s database failures", async table => {
    db.fail = table;
    expect((await queryRoom({ rideId })).ok).toBe(false);
    expect((await insertRoomMessage({ rideId, body: "Hello" })).ok).toBe(false);
  });
  it("rejects cursor injection and forged identities before database access", async () => {
    expect((await queryRoom({ rideId, cursor: { id: "x),id.gt.0", created_at: "today" } })).ok).toBe(false);
    expect((await insertRoomMessage({ rideId, body: "Hello", sender_id: "driver" })).ok).toBe(false);
    expect(db.reads).toHaveLength(0);
  });
  it("keeps cancelled rides read-only", async () => {
    db.tables.rides[0].status = "cancelled";
    expect((await queryRoom({ rideId })).ok).toBe(true);
    expect(await insertRoomMessage({ rideId, body: "Hello" })).toMatchObject({ ok: false, code: "closed" });
  });
});

it("denies contact roster access before acceptance and when phone is missing", async () => {
  db.tables.bookings[0].status="requested";
  expect((await queryRoom({rideId})).ok).toBe(false);
  expect(db.reads.some(columns=>columns.includes("social_url"))).toBe(false);
  db.tables.bookings[0].status="accepted";
  db.tables.profiles.find(p=>p.id==="passenger")!.phone=null;
  expect((await queryRoom({rideId})).ok).toBe(false);
});
