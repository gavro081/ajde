import Link from 'next/link'

export default function ProfileNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12">
      <section className="max-w-md rounded-3xl border border-slate-200 bg-white p-9 text-center shadow-xl shadow-slate-200/60">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">Profile</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Student not found</h1>
        <p className="mt-3 leading-7 text-slate-600">
          This profile may not exist yet, or it may no longer be available.
        </p>
        <Link
          href="/rides"
          className="mt-7 inline-flex rounded-2xl bg-coral-600 px-5 py-3 font-semibold text-white hover:bg-coral-700"
        >
          Browse rides
        </Link>
      </section>
    </main>
  )
}

