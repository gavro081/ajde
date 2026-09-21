import { getImpactSummary, type ImpactSummary, type ImpactTotal } from "@/lib/impact/queries";

function Counter({ title, total }: { title: string; total: ImpactTotal }) {
  return <div className="surface-card p-7">
    <h3 className="eyebrow">{title}</h3>
    <p className="mt-3 break-words font-display text-4xl font-extrabold tracking-[-.04em] text-brand-700">
      {new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(total.savedCo2Kg)}
      <span className="ml-2 text-base font-medium">kg CO₂</span>
    </p>
    <details className="mt-4 text-sm text-slate-500"><summary>Trips included</summary><p className="mt-2">{total.includedTrips} included / {total.eligibleTrips} eligible trips · {total.excludedTrips} excluded</p></details>
    {total.eligibleTrips === 0 ? <p className="mt-2 text-sm text-slate-600">No completed shared trips with accepted seats yet.</p> : null}
    {total.eligibleTrips > 0 && total.includedTrips === 0 ? <p className="mt-2 text-sm text-slate-600">Eligible trips exist, but none have supported, valid calculation data.</p> : null}
  </div>;
}

export async function ImpactSummaryPanel() {
  let summary: ImpactSummary;
  try {
    summary = await getImpactSummary();
  } catch {
    return <section aria-labelledby="impact-heading" className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 id="impact-heading" className="text-xl font-bold">Estimated CO₂ savings</h2>
      <p role="status" className="mt-2 text-sm text-amber-900">Impact estimates are unavailable right now. Reload this page to try again.</p>
    </section>;
  }
  return <section aria-labelledby="impact-heading" className="mt-14">
    <h2 id="impact-heading" className="font-display text-2xl font-bold tracking-[-.03em]">Estimated CO₂ savings</h2>
    <div className="mt-6 grid gap-6 sm:grid-cols-2">
      <Counter title="Your passenger savings" total={summary.personal} />
      <Counter title="Platform passenger savings" total={summary.platform} />
    </div>
    <details className="mt-4 text-sm text-slate-700">
      <summary className="cursor-pointer font-semibold">How these estimates work</summary>
      <div className="mt-3 space-y-2">{summary.assumptions.map(assumption => <p key={assumption}>{assumption}</p>)}</div>
    </details>
  </section>;
}
