import { getImpactSummary, type ImpactSummary, type ImpactTotal } from "@/lib/impact/queries";

const kg = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function ImpactCounter({ title, description, total, highlight = false }: { title: string; description: string; total: ImpactTotal; highlight?: boolean }) {
  return <div className={`surface-card flex flex-col p-6 sm:p-7 ${highlight ? "!border-brand-200 bg-brand-50" : ""}`}>
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-full ${highlight ? "bg-brand-600 text-white" : "bg-slate-100 text-brand-700"}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4c-9 0-15 4-15 11 0 1.6.5 3 1.3 4.2C8 15 11 12 15 10c-3.4 2.6-6 5.9-7.3 9.6.9.3 1.8.4 2.8.4C17 20 20 14 20 4Z" /></svg>
      </span>
      <div><h3 className="font-semibold leading-tight text-slate-900">{title}</h3><p className="mt-0.5 text-sm text-slate-500">{description}</p></div>
    </div>
    <p className="mt-6 flex items-baseline gap-1.5 font-display text-slate-950">
      <span className="text-5xl font-extrabold tracking-[-.045em]" style={{ fontVariantNumeric: "tabular-nums" }}>{kg.format(total.savedCo2Kg)}</span>
      <span className="text-xl font-bold text-slate-500">kg</span>
    </p>
    <p className="mt-1 text-sm font-medium text-brand-700">CO₂ kept out of the air</p>
    <p className="mt-6 border-t border-slate-900/8 pt-4 text-sm text-slate-500">
      {total.eligibleTrips === 0 ? "No completed shared trips yet."
        : total.includedTrips === 0 ? "Trips found, but none had enough data to estimate."
        : <>{total.includedTrips} of {total.eligibleTrips} trip{total.eligibleTrips === 1 ? "" : "s"} counted{total.excludedTrips ? ` · ${total.excludedTrips} excluded` : ""}</>}
    </p>
  </div>;
}

export function ImpactSummarySkeleton() {
  return <div aria-busy="true" className="mt-14">
    <p role="status" className="sr-only">Loading impact summary…</p>
    <div aria-hidden="true"><div className="skeleton h-8 w-64" /><div className="skeleton mt-2 h-4 w-80 max-w-full" /><div className="mt-6 grid gap-6 sm:grid-cols-2"><div className="skeleton h-[16.75rem] rounded-3xl" /><div className="skeleton h-[16.75rem] rounded-3xl" /></div></div>
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
    <p className="mt-1 text-slate-500">Estimated from completed rides where seats were shared.</p>
    <div className="mt-6 grid gap-6 sm:grid-cols-2">
      <ImpactCounter highlight title="Your savings" description="From rides you took as a passenger" total={summary.personal} />
      <ImpactCounter title="Across the platform" description="From every completed shared ride" total={summary.platform} />
    </div>
    <details className="mt-4 text-sm text-slate-600">
      <summary className="cursor-pointer font-semibold">How these estimates work</summary>
      <div className="mt-3 space-y-2">{summary.assumptions.map(assumption => <p key={assumption}>{assumption}</p>)}</div>
    </details>
  </section>;
}
