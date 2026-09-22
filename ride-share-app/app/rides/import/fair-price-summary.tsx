import type { CheckTraceEntry } from "@/lib/ai/ride-check-contract";

export function FairPriceSummary({ entry }: { entry: CheckTraceEntry }) {
  if ("error" in entry.result) return <li>Fair share unavailable: {entry.result.error.slice(0, 300)}</li>;
  if (!("pricePerSeatMkd" in entry.result)) return <li>Fair-share evidence unavailable.</li>;
  const { pricePerSeatMkd, totalTripCostMkd, assumptions: a } = entry.result;
  return <li>
    <p>Fair share: {pricePerSeatMkd} MKD per seat; {Number(totalTripCostMkd.toFixed(2))} MKD total trip cost.</p>
    <p>Basis: {a.distanceKm} km, shared across {a.availableSeats} available seats, {a.fuelPriceMkdL} MKD/L.</p>
    <p>{a.fuelType}{a.defaultFuelType ? " (default approximation for unknown or unsupported fuel)" : ""}, {a.consumptionL100Km} L/100 km{a.defaultConsumption ? " (default)" : ""}.</p>
    <p>Tolls are excluded. Review these assumptions and keep or edit your price.</p>
  </li>;
}
