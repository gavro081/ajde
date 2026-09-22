"use client";

import { useEffect, useId, useRef, useState } from "react";
import { aiResultSchema, type AiAnswer, type AiRequest } from "@/lib/chat/ai-contract";
import { compareMessages, type Cursor } from "@/lib/chat/contract";

const date = (value: string) => new Intl.DateTimeFormat("en-GB", {
  dateStyle: "short", timeStyle: "short", timeZone: "Europe/Skopje",
}).format(new Date(value));
const category = { decision: "Agreed", open_question: "Still open", information: "From the chat" };

/** Mounted with the room/account key. Nothing is persisted or sent to other members. */
export function ChatAiPanel({ rideId, latest, onUnavailable }: {
  rideId: string; latest: Cursor | null; onUnavailable: () => void;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [lastRequest, setLastRequest] = useState<AiRequest | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [answeredQuestion, setAnsweredQuestion] = useState("");
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const result = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const focusQuestion = useRef(false);

  useEffect(() => () => { sequence.current++; request.current?.abort(); }, []);
  useEffect(() => {
    if (!open) return;
    const dialog = panel.current!;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    if (focusQuestion.current) input.current?.focus();
    focusQuestion.current = false;
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      trigger.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!closing) return;
    // Fallback for browsers that suppress animationend (for example in a hidden tab).
    const timer = window.setTimeout(() => { setOpen(false); setClosing(false); }, 240);
    return () => window.clearTimeout(timer);
  }, [closing]);

  async function run(payload: AiRequest) {
    if (request.current || closing) return;
    const controller = new AbortController();
    request.current = controller;
    const current = ++sequence.current;
    setOpen(true); setPending(true); setError(""); setAnswer(null); setLastRequest(payload);
    try {
      const response = await fetch("/api/chat/assist", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), signal: controller.signal, cache: "no-store" });
      const parsed = aiResultSchema.safeParse(await response.json());
      if (controller.signal.aborted || current !== sequence.current) return;
      if (!parsed.success) throw new Error("Unexpected response");
      const data = parsed.data;
      if (!data.ok) {
        if (data.code === "unavailable") { setAnswer(null); setQuestion(""); onUnavailable(); }
        setError(data.error);
        return;
      }
      setAnswer(data.value);
      setAnsweredQuestion(payload.mode === "question" ? payload.question : "");
      // Announce the response inside the active dialog.
      if (panel.current?.contains(document.activeElement)) result.current?.focus();
    } catch {
      if (!controller.signal.aborted && current === sequence.current) setError("AI could not be reached. Your question is still here; please retry.");
    } finally {
      if (current === sequence.current) { request.current = null; setPending(false); }
    }
  }
  function close() {
    sequence.current++; request.current?.abort(); request.current = null;
    setPending(false);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setOpen(false);
    } else {
      setClosing(true);
    }
  }
  const stale = answer && latest && compareMessages(latest, answer.cutoff) > 0;

  return <div className="min-w-0 border-t border-slate-100 px-4 py-3 sm:px-5">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-secondary min-h-9 px-3 py-2 text-sm" disabled={pending}
        aria-haspopup="dialog" onClick={event => { trigger.current = event.currentTarget; void run({ rideId, mode: "summary" }); }}>Summarize chat</button>
      <button type="button" className="btn-secondary min-h-9 px-3 py-2 text-sm" aria-expanded={open} aria-controls={panelId}
        aria-haspopup="dialog" onClick={event => { trigger.current = event.currentTarget; focusQuestion.current = true; setOpen(true); if (open) input.current?.focus(); }}>Ask AI</button>
      <span className="text-xs text-slate-500">Only you see the answer</span>
    </div>
    {open ? <dialog ref={panel} id={panelId} aria-label="Private chat assistant" aria-describedby={`${panelId}-privacy`}
      data-closing={closing || undefined}
      onAnimationEnd={event => {
        if (closing && event.target === event.currentTarget && event.animationName === "chat-ai-close") {
          setOpen(false); setClosing(false);
        }
      }}
      onCancel={event => { event.preventDefault(); close(); }}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex="0"]')]
          .filter(element => element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      }}
      className="chat-ai-dialog fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/50">
      <div className="flex max-h-[90dvh] flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
        <div><h2 className="text-lg font-semibold">Ask about this chat</h2><p className="mt-1 text-sm text-slate-500">Only you see these questions and answers.</p></div>
        <button type="button" autoFocus onClick={close} className="btn-secondary shrink-0 px-3 py-2 text-sm" aria-label="Close AI panel">Close</button>
      </header>
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3 sm:px-7">
        <button type="button" disabled={pending || closing} className="btn-secondary min-h-9 px-3 py-2 text-sm disabled:opacity-50"
          onClick={() => void run({ rideId, mode: "summary" })}>Summarize chat</button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-7">
      <p id={`${panelId}-privacy`} className="mb-4 text-xs leading-5 text-slate-500">Using AI sends this room’s messages to OpenAI, including anything members typed into them.</p>
      <form className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4" onSubmit={event => { event.preventDefault(); if (question.trim()) void run({ rideId, mode: "question", question: question.trim() }); }}>
        <label htmlFor={`${panelId}-question`} className="text-sm font-semibold text-slate-900">Your question</label>
        <textarea ref={input} id={`${panelId}-question`} value={question} onChange={event => setQuestion(event.target.value)}
          maxLength={1000} rows={2} className="field mt-1 w-full resize-y" disabled={pending}
          placeholder="Where did we agree to meet?" aria-describedby={`${panelId}-hint`} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p id={`${panelId}-hint`} className="text-xs text-slate-500">Ask a complete question each time · {question.length}/1000</p>
          <button type="submit" disabled={pending || !question.trim()} className="btn-primary min-h-9 px-4 py-2 text-sm disabled:opacity-50">Ask about chat</button>
        </div>
      </form>
      <p role="status" className="mt-2 text-sm text-slate-600">{pending ? "Reading the chat…" : ""}</p>
      {error ? <div className="mt-2"><p role="alert" className="text-sm text-red-700">{error}</p>
        {lastRequest ? <button type="button" className="mt-2 text-sm font-semibold text-brand-700 underline" disabled={pending}
          onClick={() => void run(lastRequest)}>Retry AI request</button> : null}</div> : null}
      <div ref={result} tabIndex={-1} aria-label="AI response" aria-live="polite" className="[overflow-wrap:anywhere] focus:outline-brand-500">
        {answer ? <div className="mt-6 space-y-4 border-t border-slate-200 pt-5">
          {answer.mode === "question" ? <div className="ml-4 rounded-xl rounded-tr-sm border border-slate-200 bg-slate-100 px-4 py-3 sm:ml-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">You asked</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-900">{answeredQuestion}</p>
          </div> : null}
          <div className="space-y-4 rounded-xl border border-brand-200 border-l-4 border-l-brand-500 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="rounded-md bg-brand-100 px-2 py-1 text-xs font-bold text-brand-800">AI</span>
            <h3 className="font-semibold text-slate-950">{answer.mode === "summary" ? "Chat summary" : "AI answer"}</h3>
          </div>
          {answer.insufficientEvidence ? <p className="text-sm">{answer.mode === "question" ? "The chat does not say." : "There is not enough information in the chat to summarize yet."}</p> :
            <ul className="space-y-3">{answer.items.map((item, index) => <li key={index}>
              <p className="text-xs font-semibold text-brand-700">{category[item.category]}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{item.text}</p>
              <details className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><summary className="cursor-pointer font-medium">Source messages ({item.sources.length})</summary>
                <ul className="mt-2 space-y-2">{item.sources.map(source => <li key={source.id} className="rounded-lg border border-slate-200 bg-white p-2">
                  <p className="font-semibold">{source.author} · <time dateTime={source.created_at}>{date(source.created_at)}</time> · Skopje time</p>
                  <blockquote className="mt-1 whitespace-pre-wrap">{source.body}</blockquote>
                </li>)}</ul>
              </details>
            </li>)}</ul>}
          <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">Based on {answer.messageCount} messages through {date(answer.cutoff.created_at)} (Skopje time). Check the source messages before relying on the answer.</p>
          {stale ? <p role="status" className="text-sm font-medium text-amber-800">New messages since this answer.</p> : null}
          <button type="button" className="text-sm font-semibold text-brand-700 underline" disabled={pending}
            onClick={() => void run(answer.mode === "summary" ? { rideId, mode: "summary" } : { rideId, mode: "question", question: answeredQuestion })}>Refresh AI answer</button>
          </div>
        </div> : null}
      </div>
      </div></div>
    </dialog> : null}
  </div>;
}
