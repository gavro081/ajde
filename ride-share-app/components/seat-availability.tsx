function SeatIcon({ free }: { free: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className={free ? "text-brand-600" : "text-slate-300"}>
    <path d="M6.5 3.5h3.2a1.8 1.8 0 0 1 1.8 1.8v7.2h5.2a2.3 2.3 0 0 1 2.3 2.3v2.7H8.8a2.3 2.3 0 0 1-2.3-2.3V3.5Z" fill={free ? "var(--color-brand-100)" : "currentColor"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9 17.5v3m8-3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>;
}

export function SeatAvailability({ available, total }: { available: number; total: number }) {
  const occupied = total - available;
  return (
    <div aria-label={`${available} of ${total} seats available`}>
      <div className="flex flex-wrap gap-0.5" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => <SeatIcon key={index} free={index >= occupied} />)}
      </div>
      <p className="mt-1 text-sm font-medium text-slate-700">
        {available === 0 ? "Full" : `${available} seat${available === 1 ? "" : "s"} left`}
      </p>
    </div>
  );
}
