import { type RideDraft } from "./ride-draft";
import { valuesFromDraft, type OfferValues } from "./offer-values";
import type { OfferTrip } from "./offer-interpretation";

export type OfferTab = {
  id: string; source: RideDraft["source"]; importId: string | null; values: OfferValues;
  warnings: RideDraft["warnings"]; revision: number; distanceEpoch: number;
  distanceMode: "auto" | "manual" | "resolved" | "error"; distanceMessage: string;
  publishedId: string | null;
};
export function createOfferTab(draft: RideDraft, id: string): OfferTab {
  return { id, source: draft.source, importId: draft.importId, values: valuesFromDraft(draft), warnings: draft.warnings,
    revision: 0, distanceEpoch: 0, distanceMode: draft.distanceKm === null ? "auto" : "manual", distanceMessage: "", publishedId: null };
}
export function editOfferTab(tab: OfferTab, values: OfferValues): OfferTab {
  const changedRoute = values.originCityId !== tab.values.originCityId || values.destinationCityId !== tab.values.destinationCityId;
  const changedDistance = values.distanceKm !== tab.values.distanceKm;
  return { ...tab, revision: tab.revision + 1, values: changedRoute ? { ...values, distanceKm: "" } : values,
    distanceEpoch: tab.distanceEpoch + (changedRoute || changedDistance ? 1 : 0),
    distanceMode: changedRoute ? "auto" : changedDistance ? "manual" : tab.distanceMode,
    distanceMessage: changedRoute || changedDistance ? "" : tab.distanceMessage };
}
export function applyOfferTrip(tab: OfferTab, trip: OfferTrip): OfferTab {
  const from = valuesFromDraft(trip.draft), values = { ...tab.values };
  const fields = {
    origin: ["originCityId", "originPickupId"], destination: ["destinationCityId", "destinationPickupId"],
    car: ["carMode", "catalogModelId", "catalogQuery", "consumption", "existingCarId", "manualFuelType", "carMake", "carModel", "carSeatsTotal", "carColor", "plateLast3"],
    seatsTotal: ["seatsTotal"], pricePerSeatMkd: ["pricePerSeatMkd"], notes: ["notes"], tags: ["tags"], genderPreference: ["genderPreference"],
  } as const;
  for (const mention of trip.mentioned) {
    if (mention === "departureDate" || mention === "departureTime") continue;
    for (const field of fields[mention]) Object.assign(values, { [field]: from[field] });
  }
  if (trip.mentioned.includes("departureDate") || trip.mentioned.includes("departureTime")) {
    const [oldDate = "", oldTime = ""] = values.departureLocal.split("T");
    const date = trip.mentioned.includes("departureDate") ? trip.dateLocal ?? "" : oldDate;
    const time = trip.mentioned.includes("departureTime") ? trip.timeLocal ?? "" : oldTime;
    values.departureLocal = date || time ? `${date}T${time}` : "";
  }
  return { ...editOfferTab(tab, values), warnings: [
    ...tab.warnings.filter(w => w.field && !trip.mentioned.some(m => m === w.field || (m.startsWith("departure") && w.field === "departureAt"))),
    ...trip.draft.warnings,
  ] };
}
