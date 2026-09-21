import { z } from "zod";
import { rideDraftWarningSchema } from "./ride-draft";
import { offerValuesSchema, departureInstant } from "./offer-values";
import { editOfferTab, type OfferTab } from "./offer-tabs";

const tabSchema = z.object({
  id: z.uuid(), source: z.enum(["native", "imported"]), importId: z.uuid().nullable(), values: offerValuesSchema,
  warnings: z.array(rideDraftWarningSchema), revision: z.number().int().nonnegative(), distanceEpoch: z.number().int().nonnegative(),
  distanceMode: z.enum(["auto", "manual", "resolved", "error"]), distanceMessage: z.string(), publishedId: z.uuid().nullable(),
});
export const offerRecoverySchema = z.object({ version: z.literal(1), userId: z.string(), activeId: z.uuid(),
  tabs: z.array(tabSchema).min(1), text: z.string().max(6000), correction: z.string().max(6000), filled: z.boolean(),
}).refine(value => new Set(value.tabs.map(tab => tab.id)).size === value.tabs.length && value.tabs.some(tab => tab.id === value.activeId));

type Catalog = { cities: { id: number }[]; pickupPoints: { id: number; city_id: number }[]; cars: { id: string }[]; carModels: { id: number }[] };
export function validateRecoveredTab(tab: OfferTab, catalog: Catalog): OfferTab {
  if (tab.publishedId) return tab;
  const values = { ...tab.values }, warnings = [...tab.warnings];
  for (const key of ["origin", "destination"] as const) {
    const cityField = key === "origin" ? "originCityId" : "destinationCityId";
    const pickupField = key === "origin" ? "originPickupId" : "destinationPickupId";
    if (values[cityField] && !catalog.cities.some(city => String(city.id) === values[cityField])) {
      values[cityField] = ""; warnings.push({ field: key, code: "needs_review", message: "A saved city is no longer available. Choose it again." });
    }
    if (values[pickupField] && !catalog.pickupPoints.some(point => String(point.id) === values[pickupField] && String(point.city_id) === values[cityField])) values[pickupField] = "";
  }
  if (values.carMode === "existing" && values.existingCarId && !catalog.cars.some(car => car.id === values.existingCarId)) {
    values.existingCarId = ""; warnings.push({ field: "car", code: "needs_review", message: "Choose a currently available saved car." });
  }
  if (values.catalogModelId && !catalog.carModels.some(model => String(model.id) === values.catalogModelId)) {
    values.catalogModelId = ""; values.consumption = "";
    warnings.push({ field: "car", code: "needs_review", message: "Choose a currently available car model." });
  }
  const instant = departureInstant(values.departureLocal);
  if (instant && Date.parse(instant) <= Date.now()) warnings.push({ field: "departureAt", code: "needs_review", message: "The recovered departure has passed. Choose a future time." });
  return { ...editOfferTab(tab, values), warnings, distanceMessage: tab.distanceMode === "auto" ? "" : tab.distanceMessage };
}
