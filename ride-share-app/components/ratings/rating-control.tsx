import type { RatingControlState } from "@/lib/ratings/types";
import { RatingForm } from "./rating-form";
import { SubmittedRatingDetail } from "./submitted-rating";

export function RatingControl({ state, rideId, rateeId, targetName }: {
  state: RatingControlState | undefined;
  rideId: string;
  rateeId: string;
  targetName: string;
}) {
  if (!state) return null;
  return <section className="mt-6 border-t border-slate-100 pt-6" aria-label="Completed-ride feedback">
    {state.status === "submitted" ? <SubmittedRatingDetail rating={state.rating} /> : <RatingForm rideId={rideId} rateeId={rateeId} targetName={targetName} />}
  </section>;
}
