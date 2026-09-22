/** Product limits for student rides between cities in North Macedonia. */
export const RIDE_LIMITS = {
  seats: { min: 1, max: 8 },
  priceMkd: { min: 0, max: 3_000 },
  distanceKm: { min: 1, max: 600 },
  consumptionL100Km: { min: 0.5, max: 30 },
  tollsMkd: { min: 0, max: 2_000 },
  advanceDays: 90,
  makeLength: 80,
  modelLength: 120,
  colorLength: 40,
  notesLength: 2_000,
} as const;

export function latestDeparture(now: Date) {
  return new Date(now.getTime() + RIDE_LIMITS.advanceDays * 24 * 60 * 60 * 1_000);
}
