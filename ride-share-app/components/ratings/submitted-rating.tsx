import type { SubmittedRating } from "@/lib/ratings/types";

export function SubmittedRatingDetail({ rating }: { rating: SubmittedRating }) {
  return <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
    <p className="font-semibold">Your submitted rating: {rating.score} out of 5</p>
    {rating.note ? <><p className="mt-2 font-medium">Your private feedback</p><p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{rating.note}</p></> : null}
    <p className="mt-2 text-emerald-800">Ratings cannot be edited or deleted.</p>
  </div>;
}
