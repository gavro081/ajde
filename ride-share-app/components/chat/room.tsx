"use client";

import { startTransition, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ContactDetails } from "@/components/contact-details";
import { loadRoom, sendRoomMessage } from "@/lib/chat/actions";
import { isRoomEvent, mergeMessages, type Cursor, type Member, type Message, type RoomPage } from "@/lib/chat/contract";
import { createClient } from "@/lib/supabase/client";

export function ParticipantRoster({ members }: { members: Member[] }) {
  return <ul aria-label="Room participants" className="flex gap-2 lg:flex-col">
    {members.map(member => <li key={member.id} className="w-60 shrink-0 rounded-xl bg-slate-50 p-3 text-sm lg:w-auto">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={member.photo_url} alt="" className="size-8 shrink-0 rounded-full object-cover" />
        <span className="min-w-0 break-words font-medium">{member.full_name}{member.isDriver ? " · Driver" : ""}</span>
      </div>
      <ContactDetails phone={member.phone} socialUrl={member.social_url} instagram={member.instagram} facebook={member.facebook} />
    </li>)}
  </ul>;
}

export function MessageList({ messages, viewerId }: { messages: Message[]; viewerId: string }) {
  if (!messages.length) return <p className="p-6 text-center text-slate-500">No messages yet. Say hello to your ride group.</p>;
  return <ol aria-label="Room messages" className="space-y-3 p-4 sm:p-5">
    {messages.map(message => <li key={message.id} className={`w-fit max-w-[85%] rounded-2xl px-4 py-3 ${message.sender_id === viewerId ? "ml-auto rounded-br-md bg-brand-50" : "rounded-bl-md bg-slate-100"}`}>
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

  if (unavailable) return <section role="status" className="surface-card p-8"><h1 className="font-display text-2xl font-extrabold tracking-[-.03em]">Ride room unavailable</h1><p className="mt-2 text-slate-600">You no longer have access to this room.</p><Link className="btn-primary mt-5" href="/rides">Find a ride</Link></section>;
  const connected = status === "Connected";
  // Fills the viewport below the navbar: the sidebar (a strip on small screens) sits beside
  // the conversation, and only the message history scrolls.
  return <section className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-5">
    <aside className="surface-card order-first flex shrink-0 flex-col gap-3 p-3 sm:p-4 lg:order-last lg:gap-5 lg:overflow-y-auto lg:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Participants · {members.length}</p>
        <Link className="text-sm font-semibold text-brand-700 hover:underline lg:hidden" href={`/rides/${rideId}`}>Ride details</Link>
      </div>
      <div className="-mx-1 overflow-x-auto px-1 lg:mx-0 lg:overflow-visible lg:px-0"><ParticipantRoster members={members} /></div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className={`size-2 shrink-0 rounded-full ${connected ? "bg-brand-500" : "bg-amber-500"}`} aria-hidden="true" />
        <span role="status" className="font-medium">{status}</span>
        <button type="button" className="min-h-0 font-semibold text-brand-700 underline" onClick={() => setRetry(value => value + 1)}>Retry connection</button>
      </div>
      <p className="hidden text-sm leading-6 text-slate-600 lg:block">The driver and all currently accepted passengers can read new room messages. Your history begins when your booking is accepted. Messages are kept as a ride record.</p>
      <Link className="btn-secondary hidden lg:inline-flex" href={`/rides/${rideId}`}>Ride details</Link>
    </aside>

    <div className="surface-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <h1 className="font-display text-xl font-extrabold tracking-[-.03em]">Ride room</h1>
        <span className="text-xs text-slate-500">{messages.length} message{messages.length === 1 ? "" : "s"}</span>
      </header>
      <div ref={timeline} tabIndex={0} aria-label="Message history" className="min-h-40 flex-1 overflow-y-auto overscroll-contain" onScroll={() => {
        const node = timeline.current;
        if (node) nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
      }}>
        {olderCursor ? <button type="button" disabled={loadingOlder} onClick={older} className="mx-auto block min-h-0 p-3 text-sm font-semibold text-brand-700 disabled:opacity-50">{loadingOlder ? "Loading older messages…" : "Load older messages"}</button> : null}
        <MessageList messages={messages} viewerId={initial.viewerId} />
      </div>
      <p aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>
      <form className="shrink-0 space-y-2 border-t border-slate-100 p-3 sm:p-4" onSubmit={event => { event.preventDefault(); send(); }}>
        {!membership.canSend ? <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">This room is read-only. Sending closes when the ride is cancelled or 48 hours after departure.</p> : null}
        <label htmlFor="room-message" className="sr-only">Message to the ride group</label>
        <div className="flex items-stretch gap-2">
          <textarea id="room-message" ref={textarea} value={body} onChange={event => setBody(event.target.value)} maxLength={2000} rows={2} placeholder="Message the ride group…"
            disabled={pending || !membership.canSend} aria-describedby="room-keyboard" className="field max-h-40 min-h-[52px] flex-1 resize-none disabled:bg-slate-100"
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
          <button disabled={pending || !body.trim() || !membership.canSend} className="btn-primary w-[9.5rem] shrink-0 whitespace-nowrap px-0 disabled:opacity-50">{pending ? "Sending…" : "Send message"}</button>
        </div>
        <p id="room-keyboard" className="text-xs text-slate-500">Enter to send · Shift+Enter for a new line · {body.length}/2000</p>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      </form>
    </div>
  </section>;
}
