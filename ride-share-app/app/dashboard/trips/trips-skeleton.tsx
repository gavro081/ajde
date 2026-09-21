export function TripsSkeleton() {
  return <div aria-busy="true">
    <p role="status" className="sr-only">Loading trips…</p>
    <div aria-hidden="true" className="dashboard-grid">
      {[0, 1, 2].map((card) => <div key={card} className="journey-card">
        <div className="flex items-center justify-between gap-4">
          <div className="h-4 w-36 skeleton" />
          <div className="h-7 w-24 skeleton rounded-full" />
        </div>
        <div className="mt-7 h-8 w-3/4 skeleton" />
        <div className="mt-6 h-5 w-1/2 skeleton" />
        <div className="mt-8 h-12 skeleton rounded-xl" />
      </div>)}
    </div>
  </div>;
}
