export function SeatAvailability({ available, total }: { available: number; total: number }) {
  const occupied = total - available;
  return (
    <div aria-label={`${available} of ${total} seats available`}>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-5 w-5 rounded-t-lg rounded-b-sm border ${
              index < occupied
                ? "border-slate-300 bg-slate-300"
                : "border-emerald-600 bg-emerald-100"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-sm font-medium text-slate-700">
        {available === 0 ? "Full" : `${available} seat${available === 1 ? "" : "s"} left`}
      </p>
    </div>
  );
}
