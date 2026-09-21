export function formatDeparture(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Skopje",
  }).format(new Date(value));
}
