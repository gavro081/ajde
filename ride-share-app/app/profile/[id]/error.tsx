'use client'

export default function ProfileError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12">
      <section className="max-w-md rounded-3xl border border-slate-200 bg-white p-9 text-center shadow-xl shadow-slate-200/60">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-rose-700">Connection error</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">The profile did not load</h1>
        <p className="mt-3 leading-7 text-slate-600">
          The service may be temporarily unavailable. Your session and data are safe.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 rounded-2xl bg-coral-600 px-5 py-3 font-semibold text-white hover:bg-coral-700"
        >
          Try again
        </button>
      </section>
    </main>
  )
}

