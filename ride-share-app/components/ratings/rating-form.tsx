"use client";

import { useActionState, useId } from "react";

import { submitRating } from "@/lib/ratings/actions";
import { StarRatingInput } from "./star-rating";
import { SubmittedRatingDetail } from "./submitted-rating";

export function RatingForm({ rideId, rateeId, targetName }: { rideId: string; rateeId: string; targetName: string }) {
  const id = useId();
  const [state, action, pending] = useActionState(submitRating, null);
  if (state?.status === "submitted") return <div role="status"><p className="mb-3 text-sm font-medium text-slate-700">{state.message}</p><SubmittedRatingDetail rating={state.rating} /></div>;
  if (state?.status === "already_rated") return <p role="status" className="text-sm text-slate-700">{state.message}</p>;

  return <form action={action} className="space-y-5" aria-label={`Rate ${targetName}`}>
    <input type="hidden" name="rideId" value={rideId} />
    <input type="hidden" name="rateeId" value={rateeId} />
    <fieldset disabled={pending} aria-describedby={`${id}-privacy`} className="min-w-0">
      <legend className="font-display text-xl font-bold tracking-tight">Rate your ride with {targetName}</legend>
      <div className="mt-3"><StarRatingInput name="score" label={`Score for ${targetName}`} /></div>
      <label htmlFor={`${id}-note`} className="mt-5 block text-sm font-medium">Private feedback (optional, up to 1000 characters)</label>
      <textarea id={`${id}-note`} name="note" maxLength={1000} rows={3} className="field mt-2 resize-y" />
      <p id={`${id}-privacy`} className="mt-3 text-sm text-slate-500">Your score contributes to their public profile average. Written feedback is visible only to you and this person. You can submit once per person for this ride.</p>
    </fieldset>
    {state?.status === "error" ? <p role="alert" className="text-sm font-medium text-red-700">{state.message}</p> : null}
    <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60 sm:w-auto">{pending ? "Saving rating…" : "Submit rating"}</button>
    <span role="status" className="sr-only">{pending ? "Saving your rating" : ""}</span>
  </form>;
}
