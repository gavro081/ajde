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
  const panel = useRef<HTMLDivElement>(null);
  const focusQuestion = useRef(false);

  useEffect(() => () => { sequence.current++; request.current?.abort(); }, []);
  useEffect(() => { if (open && focusQuestion.current) { input.current?.focus(); focusQuestion.current = false; } }, [open]);

  async function run(payload: AiRequest) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const current = ++sequence.current;
    setOpen(true); setPending(true); setError(""); setLastRequest(payload);
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
      // Do not steal focus from someone composing a room message during generation.
      if (panel.current?.contains(document.activeElement)) result.current?.focus();
    } catch {
      if (!controller.signal.aborted && current === sequence.current) setError("AI could not be reached. Your question is still here; please retry.");
    } finally {
      if (current === sequence.current) { request.current = null; setPending(false); }
    }
  }
  function close() {
    sequence.current++; request.current?.abort(); request.current = null;
    setPending(false); setOpen(false);
  }
  const stale = answer && latest && compareMessages(latest, answer.cutoff) > 0;

  return <div ref={panel} className="min-w-0 border-t border-slate-100 px-4 py-3 sm:px-5">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-secondary min-h-9 px-3 py-2 text-sm" disabled={pending}
        onClick={() => void run({ rideId, mode: "summary" })}>Summarize chat</button>
      <button type="button" className="btn-secondary min-h-9 px-3 py-2 text-sm" aria-expanded={open} aria-controls={panelId}
        onClick={() => { focusQuestion.current = true; setOpen(true); if (open) input.current?.focus(); }}>Ask AI</button>
      <span className="text-xs text-slate-500">Only you see the answer</span>
    </div>
    <p className="mt-2 text-xs leading-5 text-slate-500">Using AI sends this room’s messages to OpenAI, including anything members typed into them.</p>
    {open ? <section id={panelId} aria-label="Private chat assistant" className="mt-3 rounded-xl border border-brand-100 bg-brand-50/40 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">Ask about this chat</h2>
        <button type="button" onClick={close} className="text-sm font-semibold text-slate-600 underline">Close AI panel</button></div>
      <form onSubmit={event => { event.preventDefault(); if (question.trim()) void run({ rideId, mode: "question", question: question.trim() }); }}>
        <label htmlFor={`${panelId}-question`} className="text-sm font-medium">Your question</label>
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
      <div ref={result} tabIndex={-1} aria-label="AI response" aria-live="polite" className="max-h-64 overflow-y-auto [overflow-wrap:anywhere] focus:outline-brand-500">
        {answer ? <div className="mt-3 space-y-3 border-t border-brand-100 pt-3">
          <h3 className="font-semibold">{answer.mode === "summary" ? "Chat summary" : "Answer"}</h3>
          {answer.mode === "question" ? <p className="text-sm text-slate-600">{answeredQuestion}</p> : null}
          {answer.insufficientEvidence ? <p className="text-sm">{answer.mode === "question" ? "The chat does not say." : "There is not enough information in the chat to summarize yet."}</p> :
            <ul className="space-y-3">{answer.items.map((item, index) => <li key={index}>
              <p className="text-xs font-semibold text-brand-700">{category[item.category]}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{item.text}</p>
              <details className="mt-1 text-xs text-slate-600"><summary className="cursor-pointer font-medium">Source messages ({item.sources.length})</summary>
                <ul className="mt-2 space-y-2">{item.sources.map(source => <li key={source.id} className="rounded-lg bg-white p-2">
                  <p className="font-semibold">{source.author} · <time dateTime={source.created_at}>{date(source.created_at)}</time> · Skopje time</p>
                  <blockquote className="mt-1 whitespace-pre-wrap">{source.body}</blockquote>
                </li>)}</ul>
              </details>
            </li>)}</ul>}
          <p className="text-xs text-slate-500">Based on {answer.messageCount} messages through {date(answer.cutoff.created_at)} (Skopje time). Check the source messages before relying on the answer.</p>
          {stale ? <p role="status" className="text-sm font-medium text-amber-800">New messages since this answer.</p> : null}
          <button type="button" className="text-sm font-semibold text-brand-700 underline" disabled={pending}
            onClick={() => void run(answer.mode === "summary" ? { rideId, mode: "summary" } : { rideId, mode: "question", question: answeredQuestion })}>Refresh AI answer</button>
        </div> : null}
      </div>
    </section> : null}
  </div>;
}
