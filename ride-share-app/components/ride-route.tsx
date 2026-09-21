export function RideRoute({ origin, destination, pickup, dropoff }: { origin: string; destination: string; pickup?: string | null; dropoff?: string | null }) {
  return <dl className="route-stops">
    <div className="route-stop"><dt className="text-xs font-medium text-slate-500">Departure</dt><dd className="mt-0.5 text-lg font-medium text-slate-950">{origin}</dd><dd className="mt-0.5 text-sm text-slate-600">{pickup ?? "Agree pickup with driver"}</dd></div>
    <div className="route-stop"><dt className="text-xs font-medium text-slate-500">Destination</dt><dd className="mt-0.5 text-lg font-medium text-slate-950">{destination}</dd><dd className="mt-0.5 text-sm text-slate-600">{dropoff ?? "Agree drop-off with driver"}</dd></div>
  </dl>;
}
