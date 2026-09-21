import type { SubmittedRating } from "@/lib/ratings/types";

export function SubmittedRatingDetail({ rating }: { rating: SubmittedRating }) {
  return <div className="rounded-2xl bg-brand-50 p-5 text-sm text-slate-900">
    <p className="font-medium">Your submitted rating: {rating.score} out of 5</p>
    {rating.note ? <><p className="mt-2 font-medium">Your private feedback</p><p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{rating.note}</p></> : null}
    <p className="mt-3 text-slate-600">Ratings cannot be edited or deleted.</p>
  </div>;
}
