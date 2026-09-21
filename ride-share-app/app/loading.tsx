export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 text-slate-700" aria-busy="true">
      <p role="status" className="font-semibold">Loading Student Ride Share…</p>
      <div aria-hidden="true" className="mt-8 animate-pulse space-y-5"><div className="h-8 w-2/3 rounded-lg bg-slate-200" /><div className="h-24 rounded-2xl bg-slate-100" /><div className="grid gap-5 sm:grid-cols-2"><div className="h-52 rounded-2xl bg-slate-100" /><div className="h-52 rounded-2xl bg-slate-100" /></div></div>
    </main>
  );
}
