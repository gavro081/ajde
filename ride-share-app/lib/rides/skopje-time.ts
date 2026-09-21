const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  const existing = formatterCache.get(timeZone);
  if (existing) return existing;

  const created = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(timeZone, created);
  return created;
}

function timeZoneOffset(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - Math.floor(instant.getTime() / 1_000) * 1_000;
}

export function zonedDateTimeToUtc(
  date: string,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const [year, month, day] = date.split("-").map(Number);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = desiredAsUtc;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    candidate = desiredAsUtc - timeZoneOffset(new Date(candidate), timeZone);
  }
  return new Date(candidate).toISOString();
}

export function localDayUtcBounds(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const following = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDate = [
    following.getUTCFullYear(),
    String(following.getUTCMonth() + 1).padStart(2, "0"),
    String(following.getUTCDate()).padStart(2, "0"),
  ].join("-");

  return {
    start: zonedDateTimeToUtc(date, 0, 0, timeZone),
    end: zonedDateTimeToUtc(nextDate, 0, 0, timeZone),
  };
}
