import { getProfileRatingSummary } from "@/lib/ratings/queries";

export async function ProfileRatingSummary({ profileId }: { profileId: string }) {
  const summary = await getProfileRatingSummary(profileId);
  return <section className="mt-6 rounded-2xl bg-brand-50 p-5 sm:p-6" aria-label="Completed-ride feedback">
    <h2 className="eyebrow text-brand-700">Completed-ride feedback</h2>
    <p className="mt-2 text-lg font-medium text-slate-900">{!summary ? "Feedback summary is temporarily unavailable."
      : summary.count === 0 ? "No completed-ride ratings yet."
        : `${summary.average!.toFixed(1)} out of 5 · ${summary.count} rating${summary.count === 1 ? "" : "s"}`}</p>
  </section>;
}
