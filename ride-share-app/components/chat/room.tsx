"use client";

import { startTransition, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { loadRoom, sendRoomMessage } from "@/lib/chat/actions";
import { isRoomEvent, mergeMessages, type Cursor, type Member, type Message, type RoomPage } from "@/lib/chat/contract";
import { createClient } from "@/lib/supabase/client";

export function ParticipantRoster({ members }: { members: Member[] }) {
  return <ul aria-label="Room participants" className="flex flex-wrap gap-3">
    {members.map(member => <li key={member.id} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={member.photo_url} alt="" className="size-7 rounded-full object-cover" />
      <span>{member.full_name}{member.isDriver ? " · Driver" : ""}</span>
    </li>)}
  </ul>;
}

export function MessageList({ messages, viewerId }: { messages: Message[]; viewerId: string }) {
  if (!messages.length) return <p className="p-6 text-center text-slate-500">No messages yet. Say hello to your ride group.</p>;
  return <ol aria-label="Room messages" className="space-y-4 p-4">
    {messages.map(message => <li key={message.id} className={`max-w-[90%] rounded-2xl p-3 ${message.sender_id === viewerId ? "ml-auto bg-emerald-50" : "bg-slate-100"}`}>
      <div className="flex items-center gap-2 text-xs text-slate-600">
        {message.sender?.photo_url ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={message.sender.photo_url} alt="" className="size-6 rounded-full object-cover" />
        </> : null}
        <span className="font-semibold">{message.sender?.full_name ?? "Former participant"}</span>
        <time dateTime={message.created_at}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Skopje" }).format(new Date(message.created_at))}</time>
      </div>
      <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{message.body}</p>
    </li>)}
  </ol>;
}

export function RideRoom({ rideId, initial }: { rideId: string; initial: RoomPage }) {
  const [messages, setMessages] = useState(initial.messages);
  const messagesRef = useRef(initial.messages);
  const [members, setMembers] = useState(initial.members);
  const [membership, setMembership] = useState(initial.membership);
  const [olderCursor, setOlderCursor] = useState(initial.nextCursor);
  const [unavailable, setUnavailable] = useState(false);
  const [status, setStatus] = useState("Connecting");
  const [retry, setRetry] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [pending, sendTransition] = useTransition();
  const [loadingOlder, historyTransition] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const prependHeight = useRef<number | null>(null);
  const live = useRef(true);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (!pending && restoreFocus.current) {
      restoreFocus.current = false;
      textarea.current?.focus();
    }
  }, [pending]);

  function receive(incoming: Message[]) {
    const merged = mergeMessages(messagesRef.current, incoming);
    const added = merged.length - messagesRef.current.length;
    messagesRef.current = merged;
    setMessages(merged);
    if (added) setAnnouncement(`${added} new message${added === 1 ? "" : "s"} in the ride room.`);
  }

  useLayoutEffect(() => {
    const node = timeline.current;
    if (!node) return;
    if (prependHeight.current !== null) {
      node.scrollTop += node.scrollHeight - prependHeight.current;
      prependHeight.current = null;
    } else if (nearBottom.current) node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  useEffect(() => {
    if (unavailable) return;
    const client = createClient();
    let active = true;
    let refreshing = false;
    let refreshAgain = false;
    let connected = false;
    let offlineNow = !navigator.onLine;

    async function synchronize() {
      if (!active || offlineNow) return;
      if (refreshing) { refreshAgain = true; return; }
      refreshing = true;
      try {
        do {
          refreshAgain = false;
          const latest = messagesRef.current.at(-1);
          let cursor: Cursor | null = latest ? { id: latest.id, created_at: latest.created_at } : null;
          do {
            const result = await loadRoom({ rideId, cursor, direction: "newer" });
            if (!active) return;
            if (!result.ok) {
              if (result.code === "unavailable") {
                active = false;
                messagesRef.current = [];
                setMessages([]); setMembers([]); setUnavailable(true);
              } else setStatus("Reconnect needed");
              return;
            }
            setMembership(result.value.membership);
            setMembers(result.value.members);
            // A cancelled/reaccepted passenger must lose the earlier acceptance window.
            const joinedAt = result.value.membership.joinedAt;
            if (joinedAt) messagesRef.current = messagesRef.current.filter(m => Date.parse(m.created_at) >= Date.parse(joinedAt));
            receive(result.value.messages);
            const hadCursor = cursor !== null;
            if (!hadCursor && result.value.nextCursor) setOlderCursor(result.value.nextCursor);
            cursor = hadCursor ? result.value.nextCursor : null;
          } while (cursor && active);
          if (active) setStatus(offlineNow ? "Offline — retry when connected" : connected ? "Connected" : "Reconnecting");
        } while (refreshAgain && active);
      } catch { if (active) setStatus("Offline — retry when connected"); }
      finally { refreshing = false; }
    }
    const refresh = () => startTransition(() => { void synchronize(); });
    // A distinct channel instance prevents an asynchronous cleanup from closing a
    // replacement subscription (including React's development effect remount).
    const channel = client.channel(`ride-room:${rideId}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `ride_id=eq.${rideId}` }, payload => {
        // Re-fetch through the authorized history query instead of trusting event data.
        if (active && isRoomEvent(payload.new, rideId)) refresh();
      });
    async function subscribe() {
      try {
        // Wait for the cookie-backed session before joining an RLS-protected feed.
        const { data: { session } } = await client.auth.getSession();
        if (!active) return;
        if (!session) { setUnavailable(true); messagesRef.current = []; setMessages([]); return; }
        await client.realtime.setAuth(session.access_token);
        if (!active) return;
        channel.subscribe(state => {
        if (!active) return;
        connected = state === "SUBSCRIBED";
        setStatus(connected ? "Connected" : "Reconnecting");
        if (connected) refresh();
        });
      } catch { if (active) setStatus("Reconnect needed"); }
    }
    void subscribe();
    const timer = window.setInterval(refresh, 15000);
    const offline = () => { offlineNow = true; connected = false; setStatus("Offline — retry when connected"); };
    const online = () => setRetry(value => value + 1);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("focus", refresh);
    refresh();
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("focus", refresh);
      void client.removeChannel(channel);
    };
  }, [rideId, retry, unavailable]);

  function send() {
    if (pending || !body.trim() || !membership.canSend || unavailable) return;
    setError("");
    restoreFocus.current = true;
    sendTransition(async () => {
      try {
        const result = await sendRoomMessage({ rideId, body });
        if (!live.current) return;
        if (!result.ok) {
          setError(result.error);
          if (result.code === "unavailable") { messagesRef.current = []; setMessages([]); setMembers([]); setUnavailable(true); }
          if (result.code === "closed") setMembership(value => ({ ...value, canSend: false }));
          return;
        }
        receive([result.value]); setBody("");
      } catch { if (live.current) setError("Message was not confirmed. Check the timeline before retrying."); }
    });
  }
  function older() {
    if (!olderCursor || loadingOlder) return;
    setError("");
    historyTransition(async () => {
      try {
        const result = await loadRoom({ rideId, cursor: olderCursor, direction: "older" });
        if (!live.current) return;
        if (!result.ok) {
          setError(result.error);
          if (result.code === "unavailable") { messagesRef.current = []; setMessages([]); setMembers([]); setUnavailable(true); }
          return;
        }
        prependHeight.current = timeline.current?.scrollHeight ?? null;
        const merged = mergeMessages(messagesRef.current, result.value.messages);
        messagesRef.current = merged; setMessages(merged); setOlderCursor(result.value.nextCursor);
        setMembers(result.value.members); setMembership(result.value.membership);
      } catch { if (live.current) setError("Older messages could not be loaded. Please retry."); }
    });
  }

  if (unavailable) return <section role="status" className="rounded-2xl border p-8"><h1 className="text-2xl font-bold">Ride room unavailable</h1><p className="mt-2">You no longer have access to this room.</p><Link className="mt-4 inline-block underline" href="/rides">Find a ride</Link></section>;
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="space-y-4 border-b p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold">Ride room</h1><Link className="text-sm text-emerald-700 underline" href={`/rides/${rideId}`}>Ride details</Link></div>
      <p className="text-sm text-slate-600">The driver and all currently accepted passengers can read new room messages. Your history begins when your booking is accepted. Messages are kept as a ride record.</p>
      <ParticipantRoster members={members} />
      <div className="flex items-center gap-3 text-sm"><span role="status">{status}</span><button type="button" className="font-semibold text-emerald-700 underline" onClick={() => setRetry(value => value + 1)}>Retry connection</button></div>
    </header>
    <div ref={timeline} tabIndex={0} aria-label="Message history" className="h-[45vh] min-h-60 overflow-y-auto overscroll-contain" onScroll={() => {
      const node = timeline.current;
      if (node) nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
    }}>
      {olderCursor ? <button type="button" disabled={loadingOlder} onClick={older} className="mx-auto block p-3 text-sm font-semibold text-emerald-700 disabled:opacity-50">{loadingOlder ? "Loading older messages…" : "Load older messages"}</button> : null}
      <MessageList messages={messages} viewerId={initial.viewerId} />
    </div>
    <p aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>
    <form className="space-y-2 border-t p-4" onSubmit={event => { event.preventDefault(); send(); }}>
      {!membership.canSend ? <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">This room is read-only. Sending closes when the ride is cancelled or 48 hours after departure.</p> : null}
      <label htmlFor="room-message" className="block text-sm font-semibold">Message to the ride group</label>
      <textarea id="room-message" ref={textarea} value={body} onChange={event => setBody(event.target.value)} maxLength={2000} rows={3}
        disabled={pending || !membership.canSend} aria-describedby="room-keyboard" className="w-full resize-y rounded-xl border border-slate-300 p-3 disabled:bg-slate-100"
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
      <div className="flex items-center justify-between gap-3"><p id="room-keyboard" className="text-xs text-slate-500">Enter to send · Shift+Enter for a new line · {body.length}/2000</p><button disabled={pending || !body.trim() || !membership.canSend} className="rounded-xl bg-emerald-700 px-5 py-2 font-semibold text-white disabled:opacity-50">{pending ? "Sending…" : "Send message"}</button></div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </form>
  </section>;
}
