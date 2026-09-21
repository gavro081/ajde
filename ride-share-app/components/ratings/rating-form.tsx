"use client";

import { useActionState, useId } from "react";

import { submitRating } from "@/lib/ratings/actions";
import { SubmittedRatingDetail } from "./submitted-rating";

const scores = ["1 — Poor", "2 — Fair", "3 — Good", "4 — Very good", "5 — Excellent"];

export function RatingForm({ rideId, rateeId, targetName }: { rideId: string; rateeId: string; targetName: string }) {
  const id = useId();
  const [state, action, pending] = useActionState(submitRating, null);
  if (state?.status === "submitted") return <div role="status"><p className="mb-2 text-sm font-medium text-emerald-800">{state.message}</p><SubmittedRatingDetail rating={state.rating} /></div>;
  if (state?.status === "already_rated") return <p role="status" className="text-sm text-slate-700">{state.message}</p>;

  return <form action={action} className="space-y-4" aria-label={`Rate ${targetName}`}>
    <input type="hidden" name="rideId" value={rideId} />
    <input type="hidden" name="rateeId" value={rateeId} />
    <fieldset disabled={pending} aria-describedby={`${id}-privacy`}>
      <legend className="font-semibold">Rate your ride with {targetName}</legend>
      <div className="mt-3 flex flex-wrap gap-2">{scores.map((label, index) => <label key={label} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm has-checked:border-emerald-700 has-checked:bg-emerald-50 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-700">
        <input type="radio" name="score" value={index + 1} required className="accent-emerald-700" />{label}
      </label>)}</div>
      <label htmlFor={`${id}-note`} className="mt-4 block text-sm font-medium">Private feedback (optional, up to 1000 characters)</label>
      <textarea id={`${id}-note`} name="note" maxLength={1000} rows={3} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus-visible:outline-2 focus-visible:outline-emerald-700" />
      <p id={`${id}-privacy`} className="mt-2 text-sm text-slate-600">Your score contributes to their public profile average. Written feedback is visible only to you and this person. You can submit once per person for this ride.</p>
    </fieldset>
    {state?.status === "error" ? <p role="alert" className="text-sm font-medium text-red-700">{state.message}</p> : null}
    <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60">{pending ? "Saving rating…" : "Submit rating"}</button>
    <span role="status" className="sr-only">{pending ? "Saving your rating" : ""}</span>
  </form>;
}
