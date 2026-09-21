import { getProfileRatingSummary } from "@/lib/ratings/queries";
import type { RatingSummary } from "@/lib/ratings/types";
import { StarDisplay } from "./star-rating";

export async function ProfileRatingSummary({ profileId }: { profileId: string }) {
  return <RatingSummaryView summary={await getProfileRatingSummary(profileId)} />;
}

export function RatingSummaryView({ summary }: { summary: RatingSummary | null }) {
  return <section className="mt-8 border-t border-slate-200 pt-7" aria-labelledby="rating-heading">
    <h2 id="rating-heading" className="text-sm font-semibold text-slate-500">Ride rating</h2>
    {!summary ? <p className="mt-2 text-slate-600">The rating summary is unavailable right now. Try again in a moment.</p>
      : summary.count === 0 ? <div className="mt-3 flex flex-wrap items-center gap-3">
        <StarDisplay score={0} size={22} label="No ratings yet" />
        <p className="text-slate-600">No ratings yet. They appear after completed shared rides.</p>
      </div>
        : <div className="mt-3 flex items-center gap-4">
          <p className="font-display text-5xl font-extrabold leading-none tracking-[-.045em] text-slate-950">{summary.average!.toFixed(1)}</p>
          <div>
            <StarDisplay score={summary.average!} size={22} label={`${summary.average!.toFixed(1)} out of 5 stars`} />
            <p className="mt-1 text-sm text-slate-500">Based on {summary.count} completed-ride rating{summary.count === 1 ? "" : "s"}</p>
          </div>
        </div>}
  </section>;
}
