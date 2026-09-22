import type { CheckTraceEntry } from "@/lib/ai/ride-check-contract";

const departureFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Skopje", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function SimilarRidesSummary({ entry, cities }: { entry: CheckTraceEntry; cities: { id: number; name_en: string }[] }) {
  if ("error" in entry.result) return <li>Similar-ride search unavailable: {entry.result.error.slice(0, 300)}</li>;
  if (!("rides" in entry.result) || !entry.args || !("departureAt" in entry.args)) return <li>Similar-ride search evidence unavailable.</li>;
  const args = entry.args;
  const origin = cities.find(city => city.id === args.originCityId)?.name_en ?? "Origin city";
  const destination = cities.find(city => city.id === args.destinationCityId)?.name_en ?? "Destination city";
  if (!entry.result.rides.length) return <li>No published or full ride offers found on {origin} → {destination} within three hours of departure. This limited search does not rule out other duplicates.</li>;
  return <li>
    <p>Possible duplicates: {origin} → {destination} (same route, within three hours).</p>
    <ul className="mt-1 space-y-1 pl-4">
      {entry.result.rides.map(ride => <li key={ride.id}>
        <a className="underline" href={`/rides/${ride.id}`} target="_blank" rel="noreferrer">
          {departureFormatter.format(new Date(ride.departureAt))} (Skopje) · {ride.pricePerSeatMkd === null ? "Price unavailable" : `${ride.pricePerSeatMkd} MKD per seat`} · {ride.seatsAvailable} available seats
        </a>
      </li>)}
    </ul>
    <p className="mt-1">Review these matches before deciding whether to publish. Similar route and time do not establish a duplicate.</p>
  </li>;
}
