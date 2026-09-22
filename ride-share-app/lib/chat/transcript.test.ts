import { beforeEach, describe, expect, it, vi } from "vitest";
import { compareMessages } from "./contract";
import type { roomAccess } from "./server";
vi.mock("server-only", () => ({}));
import { loadTranscript, MAX_TRANSCRIPT_CHARACTERS, TranscriptTooLarge } from "./transcript";

const uuid = (n: number) => `94000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Row = { id: string; created_at: string; sender_id: string; body: string; ride_id: string; recipient_id: string | null };
let rows: Row[], cap: number, pageReads: number, fail: string, projections: string[], injectNew: boolean;
const rideId = uuid(1);
const base = { created_at: "2026-09-21T12:00:00.000001Z", sender_id: "driver", body: "Pickup at 17:30", ride_id: rideId, recipient_id: null };
const access = { ok: true, ride: { id: rideId, driver_id: "driver" }, supabase: {
  from(table: string) {
    let filtered: (Row | { id: string; full_name: string; phone: string })[] = table === "messages" ? [...rows] : [{ id: "driver", full_name: "Ana", phone: "PRIVATE" }];
    let limit = Infinity;
    const chain = {
      select(columns: string) { projections.push(columns); return chain; },
      eq(key: string, value: unknown) { filtered = filtered.filter(row => row[key as keyof typeof row] === value); return chain; },
      is(key: string, value: unknown) { return chain.eq(key, value); },
      in() { return chain; },
      or(filter: string) {
        const m = filter.match(/^created_at.lt.(.+),and\(created_at.eq.(.+),id.lt.(.+)\)$/)!;
        filtered = (filtered as Row[]).filter(row => compareMessages(row, { created_at: m[1], id: m[3] }) < 0);
        return chain;
      },
      order() { return chain; }, limit(n: number) { limit = Math.min(n, cap); return chain; },
      then(resolve: (value: unknown) => unknown) {
        if (table === "messages") {
          pageReads++;
          filtered = (filtered as Row[]).sort((a, b) => -compareMessages(a, b));
          if (injectNew && pageReads === 1) rows.push({ ...base, id: uuid(9999), created_at: "2026-09-21T13:00:00Z" });
        }
        return Promise.resolve({ data: filtered.slice(0, limit), error: fail === table ? {} : null }).then(resolve);
      },
    };
    return chain;
  },
} } as unknown as Extract<Awaited<ReturnType<typeof roomAccess>>, { ok: true }>;
beforeEach(() => {
  rows = Array.from({ length: 151 }, (_, i) => ({ ...base, id: uuid(i + 10) }));
  cap = Infinity; pageReads = 0; fail = ""; projections = []; injectNew = false;
});
describe("authorized full transcript", () => {
  it("includes earliest messages, orders equal timestamps, excludes DMs/other rooms and private profiles", async () => {
    rows.push({ ...base, id: uuid(200), ride_id: uuid(2) }, { ...base, id: uuid(201), recipient_id: "passenger" });
    const result = await loadTranscript(access);
    expect(result.messages).toHaveLength(151);
    expect(result.messages[0].id).toBe(uuid(10));
    expect(result.messages.at(-1)?.id).toBe(uuid(160));
    expect(result.cutoff?.id).toBe(uuid(160));
    expect(result.messages[0]).toEqual({ id: uuid(10), created_at: base.created_at, body: base.body, author: "Ana (driver)" });
    expect(projections.some(p => /phone|social|photo/.test(p))).toBe(false);
  });
  it("traverses a server row cap smaller than the requested page and pins the cutoff", async () => {
    cap = 12; injectNew = true;
    const result = await loadTranscript(access);
    expect(result.messages).toHaveLength(151);
    expect(result.cutoff?.id).toBe(uuid(160));
    expect(pageReads).toBeGreaterThan(12);
  });
  it("returns an empty snapshot without querying author profiles", async () => {
    rows = [];
    expect(await loadTranscript(access)).toEqual({ messages: [], cutoff: null });
    expect(projections).toEqual(["id, created_at, sender_id, body"]);
  });
  it("enforces both the serialized-size budget and the 1000-message ceiling", async () => {
    rows = Array.from({ length: 1000 }, (_, i) => ({ ...base, id: uuid(i + 10), body: "" }));
    // Serialized metadata itself can exceed the character budget; test the row bound separately.
    await expect(loadTranscript(access)).rejects.toBeInstanceOf(TranscriptTooLarge);
    rows.push({ ...base, id: uuid(2000) });
    await expect(loadTranscript(access)).rejects.toBeInstanceOf(TranscriptTooLarge);
  });
  it("counts JSON escaping and metadata, not just body characters", async () => {
    rows = [{ ...base, id: uuid(10), body: '"'.repeat(MAX_TRANSCRIPT_CHARACTERS / 2) }];
    await expect(loadTranscript(access)).rejects.toBeInstanceOf(TranscriptTooLarge);
    rows[0].body = "a".repeat(MAX_TRANSCRIPT_CHARACTERS + 1);
    await expect(loadTranscript(access)).rejects.toBeInstanceOf(TranscriptTooLarge);
  });
  it.each(["messages", "profiles"])("fails closed on %s query failure", async table => {
    fail = table;
    await expect(loadTranscript(access)).rejects.toThrow();
  });
});
