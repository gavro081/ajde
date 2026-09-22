import { getProfileRatingSummary } from "@/lib/ratings/queries";
import type { RatingSummary } from "@/lib/ratings/types";
import { StarDisplay } from "./star-rating";

export async function ProfileRatingSummary({ profileId }: { profileId: string }) {
  return <RatingSummaryView summary={await getProfileRatingSummary(profileId)} />;
}

export function RatingSummaryView({ summary }: { summary: RatingSummary | null }) {
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-6" aria-labelledby="rating-heading">
    <h2 id="rating-heading" className="font-display text-lg font-bold tracking-tight text-slate-950">Ride rating</h2>
    {!summary ? <p className="mt-3 text-sm leading-6 text-slate-600">The rating summary is unavailable right now. Try again in a moment.</p>
      : summary.count === 0 ? <div className="mt-4">
        <StarDisplay score={0} size={22} label="No ratings yet" />
        <p className="mt-3 font-semibold text-slate-900">No ratings yet</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">They appear after completed shared rides.</p>
      </div>
        : <div className="mt-4">
          <p className="flex items-baseline gap-2"><span className="font-display text-5xl font-extrabold leading-none tracking-[-.045em] text-slate-950">{summary.average!.toFixed(1)}</span><span className="text-sm text-slate-500">/ 5</span></p>
          <div className="mt-4">
            <StarDisplay score={summary.average!} size={22} label={`${summary.average!.toFixed(1)} out of 5 stars`} />
            <p className="mt-3 text-sm leading-6 text-slate-600">Based on {summary.count} completed-ride rating{summary.count === 1 ? "" : "s"}</p>
          </div>
        </div>}
  </section>;
}
