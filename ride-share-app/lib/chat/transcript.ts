import "server-only";
import { PAGE_SIZE, type Cursor } from "./contract";
import type { TranscriptMessage } from "./ai-contract";
import { roomAccess } from "./server";

export const MAX_TRANSCRIPT_MESSAGES = 1000;
export const MAX_TRANSCRIPT_CHARACTERS = 100_000;
type Access = Extract<Awaited<ReturnType<typeof roomAccess>>, { ok: true }>;
export type Transcript = { messages: TranscriptMessage[]; cutoff: Cursor | null };
export class TranscriptTooLarge extends Error {}

/** Read backward from a fixed newest row; new messages cannot extend this snapshot. */
export async function loadTranscript(access: Access): Promise<Transcript> {
  const { supabase, ride } = access;
  const rows: { id: string; created_at: string; sender_id: string; body: string }[] = [];
  let cursor: Cursor | null = null;
  let cutoff: Cursor | null = null;
  let bodyCharacters = 0;
  for (;;) {
    let query = supabase.from("messages").select("id, created_at, sender_id, body")
      .eq("ride_id", ride.id).is("recipient_id", null);
    if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    const { data, error } = await query.order("created_at", { ascending: false })
      .order("id", { ascending: false }).limit(PAGE_SIZE);
    if (error || !data) throw new Error("Transcript unavailable");
    // Only an empty page proves completion if PostgREST imposes a lower row cap.
    if (!data.length) break;
    cutoff ??= { id: data[0].id, created_at: data[0].created_at };
    for (const row of data) {
      rows.push(row);
      bodyCharacters += row.body.length;
      if (rows.length > MAX_TRANSCRIPT_MESSAGES || bodyCharacters > MAX_TRANSCRIPT_CHARACTERS) throw new TranscriptTooLarge();
    }
    const edge = data[data.length - 1];
    cursor = { id: edge.id, created_at: edge.created_at };
  }
  const names = new Map<string, string>();
  const authors = [...new Set(rows.map(row => row.sender_id))];
  for (let offset = 0; offset < authors.length; offset += 100) {
    const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", authors.slice(offset, offset + 100));
    if (error || !data) throw new Error("Authors unavailable");
    for (const author of data) names.set(author.id, author.full_name);
  }
  const messages = rows.reverse().map(row => ({ id: row.id, created_at: row.created_at, body: row.body,
    author: `${names.get(row.sender_id) ?? "Former participant"}${row.sender_id === ride.driver_id ? " (driver)" : ""}` }));
  if (JSON.stringify(messages).length > MAX_TRANSCRIPT_CHARACTERS) throw new TranscriptTooLarge();
  return { messages, cutoff };
}
