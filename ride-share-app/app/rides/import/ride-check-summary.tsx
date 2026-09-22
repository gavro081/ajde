import type { RideCheckMetadata, CheckTraceEntry } from "@/lib/ai/ride-check-contract";

type City = { id: number; name_en: string };

function Evidence({ entry, cities }: { entry: CheckTraceEntry; cities: City[] }) {
  const label = entry.tool === "road_distance" ? "Road distance" : "Check";
  if ("error" in entry.result) return <li>{label} unavailable: {entry.result.error.slice(0, 300)}</li>;
  if (entry.tool === "road_distance" && "distanceKm" in entry.result && entry.args) {
    const origin = cities.find(city => city.id === entry.args?.originCityId)?.name_en ?? "Origin city";
    const destination = cities.find(city => city.id === entry.args?.destinationCityId)?.name_en ?? "Destination city";
    return <li>Road distance {origin} → {destination}: {entry.result.distanceKm} km (editable city-to-city estimate).</li>;
  }
  return <li>Check evidence unavailable.</li>;
}

export function RideCheckSummary({ check, cities }: { check: RideCheckMetadata; cities: City[] }) {
  return <section className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-800" aria-label="Check evidence">
    <h3 className="font-semibold">How we checked this</h3>
    {check.status === "unavailable" ? <p className="mt-2">Automatic plausibility check was unavailable. Review every field.</p> : null}
    {check.trace.length ? <ul className="mt-2 space-y-2 break-words">
      {check.trace.map((entry, index) => <Evidence key={`${entry.callId}-${index}`} entry={entry} cities={cities} />)}
    </ul> : <p className="mt-2">No tool evidence was returned. Review every field.</p>}
    <p className="mt-2 text-xs text-slate-500">Evidence supports this review; it does not guarantee that a ride offer is correct.</p>
  </section>;
}
