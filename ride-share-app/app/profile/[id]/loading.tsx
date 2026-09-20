export default function ProfileLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10" aria-busy="true" aria-label="Loading profile">
      <div className="mx-auto max-w-2xl animate-pulse overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="h-32 bg-slate-200" />
        <div className="px-7 pb-9 sm:px-10">
          <div className="-mt-16 size-32 rounded-3xl border-4 border-white bg-slate-300" />
          <div className="mt-7 h-4 w-32 rounded bg-slate-200" />
          <div className="mt-4 h-9 w-64 max-w-full rounded bg-slate-200" />
          <div className="mt-3 h-6 w-48 max-w-full rounded bg-slate-100" />
          <div className="mt-9 h-24 rounded-2xl bg-slate-100" />
        </div>
      </div>
    </main>
  )
}

