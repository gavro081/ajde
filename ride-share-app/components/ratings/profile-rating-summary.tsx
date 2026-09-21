import { getProfileRatingSummary } from "@/lib/ratings/queries";

export async function ProfileRatingSummary({ profileId }: { profileId: string }) {
  const summary = await getProfileRatingSummary(profileId);
  return <section className="mt-6 rounded-xl bg-emerald-50 p-4" aria-label="Completed-ride feedback">
    <h2 className="font-semibold text-emerald-950">Completed-ride feedback</h2>
    <p className="mt-1 text-sm text-emerald-900">{!summary ? "Feedback summary is temporarily unavailable."
      : summary.count === 0 ? "No completed-ride ratings yet."
        : `${summary.average!.toFixed(1)} out of 5 · ${summary.count} rating${summary.count === 1 ? "" : "s"}`}</p>
  </section>;
}
