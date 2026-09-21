import { z } from "zod";
import { RIDE_TAGS, type RideDraft } from "./ride-draft";
import { zonedDateTimeToUtc } from "./skopje-time";

const text = z.string().max(2000);
export const offerValuesSchema = z.object({
  originCityId: text, destinationCityId: text, originPickupId: text, destinationPickupId: text,
  departureLocal: text, distanceKm: text, seatsTotal: text, pricePerSeatMkd: text,
  carMode: z.enum(["existing", "catalog", "manual"]), catalogQuery: text, catalogModelId: text,
  consumption: text, existingCarId: text, manualFuelType: text, carMake: text, carModel: text,
  carSeatsTotal: text, carColor: text, plateLast3: text, notes: text,
  tags: z.array(z.enum(RIDE_TAGS)), genderPreference: z.enum(["any", "same_as_driver"]),
});
export type OfferValues = z.infer<typeof offerValuesSchema>;

export function skopjeLocal(instant: string | null) {
  if (!instant || !Number.isFinite(Date.parse(instant))) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Skopje", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(instant)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function departureInstant(local: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return "";
  const [date, time] = local.split("T");
  const [hour, minute] = time.split(":").map(Number);
  const instant = zonedDateTimeToUtc(date, hour, minute, "Europe/Skopje");
  return skopjeLocal(instant) === local ? instant : "";
}

export function valuesFromDraft(draft: RideDraft): OfferValues {
  const value = (n: string | number | null | undefined) => n?.toString() ?? "";
  return {
    originCityId: value(draft.origin.cityId), destinationCityId: value(draft.destination.cityId),
    originPickupId: value(draft.origin.pickupPointId), destinationPickupId: value(draft.destination.pickupPointId),
    departureLocal: skopjeLocal(draft.departureAt), distanceKm: value(draft.distanceKm),
    seatsTotal: value(draft.seatsTotal), pricePerSeatMkd: value(draft.pricePerSeatMkd),
    carMode: draft.carId ? "existing" : draft.car?.carModelId ? "catalog" : draft.car ? "manual" : "catalog",
    catalogQuery: "", catalogModelId: value(draft.car?.carModelId), consumption: value(draft.car?.consumptionL100Km),
    existingCarId: draft.carId ?? "", manualFuelType: draft.car?.fuelType ?? "",
    carMake: draft.car?.make ?? "", carModel: draft.car?.model ?? "", carSeatsTotal: value(draft.car?.seatsTotal),
    carColor: draft.car?.color ?? "", plateLast3: draft.car?.plateLast3 ?? "",
    notes: draft.notes ?? "", tags: draft.tags, genderPreference: draft.genderPreference ?? "any",
  };
}
