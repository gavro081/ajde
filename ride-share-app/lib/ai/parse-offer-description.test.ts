import { expect, it } from "vitest";
import { parseOfferDescription, type OfferModelOutput } from "./parse-offer-description";
import { emptyOfferDraft } from "@/lib/rides/offer-interpretation";
import { valuesFromDraft } from "@/lib/rides/offer-values";

const cities = [{ id: 1, name_en: "Skopje", name_mk: "Скопје", aliases: [] }, { id: 3, name_en: "Bitola", name_mk: "Битола", aliases: [] }];
const raw: OfferModelOutput = { recurring: false, trips: [{ draft: { ...emptyOfferDraft(),
  origin: { cityId: 999, pickupPointId: null, rawText: "skp" }, destination: { cityId: 999, pickupPointId: null, rawText: "bt" } },
  mentioned: ["origin", "destination", "departureDate", "departureTime", "car"],
  dateLocal: null, weekday: 6, dateEvidence: "saturday", timeLocal: "16:00", timeEvidence: "4pm", carText: "clio" }] };
const context = { cities, pickupPoints: [], cars: [], carModels: [], now: new Date("2026-09-21T10:00:00Z"), modelRunner: async () => raw };

it("resolves skp/bt and bare 4pm to the next Saturday without inventing seats, price or a Clio variant", async () => {
  const result = await parseOfferDescription({ text: "going skp to bt 4pm saturday with a clio", mode: "create" }, context);
  expect(result.trips[0].draft).toMatchObject({ origin: { cityId: 1 }, destination: { cityId: 3 },
    departureAt: "2026-09-26T14:00:00.000Z", seatsTotal: null, pricePerSeatMkd: null, carId: null });
  expect(result.trips[0].draft.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ field: "car" })]));
});

it.each([["2026-09-26T13:59:00Z", "2026-09-26T14:00:00.000Z"], ["2026-09-26T14:00:00Z", "2026-10-03T14:00:00.000Z"]])("interprets Saturday relative to %s", async (now, expected) => {
  const result = await parseOfferDescription({ text: "skp bt saturday 4pm clio", mode: "create" }, { ...context, now: new Date(now) });
  expect(result.trips[0].draft.departureAt).toBe(expected);
});

it("clears an ambiguous mentioned time rather than retaining a previous 16:00", async () => {
  const current = valuesFromDraft({ ...emptyOfferDraft(), departureAt: "2026-09-26T14:00:00Z" });
  const result = await parseOfferDescription({ text: "actually at 4", mode: "correct", current }, {
    ...context, modelRunner: async () => ({ recurring: false, trips: [{ ...raw.trips[0], mentioned: ["departureTime"], timeEvidence: "at 4" }] }),
  });
  expect(result.trips[0]).toMatchObject({ dateLocal: "2026-09-26", timeLocal: null, draft: { departureAt: null } });
});

it("keeps a recognized date when a subsequent correction supplies the missing time", async () => {
  const current = { ...valuesFromDraft(emptyOfferDraft()), departureLocal: "2026-09-26T" };
  const result = await parseOfferDescription({ text: "at 4pm", mode: "correct", current }, {
    ...context, modelRunner: async () => ({ recurring: false, trips: [{ ...raw.trips[0], mentioned: ["departureTime"] }] }),
  });
  expect(result.trips[0].draft.departureAt).toBe("2026-09-26T14:00:00.000Z");
});

it("does not turn a missing time into a model-invented time on a date-only correction", async () => {
  const current = { ...valuesFromDraft(emptyOfferDraft()), departureLocal: "2026-09-26T" };
  const result = await parseOfferDescription({ text: "saturday", mode: "correct", current }, {
    ...context, modelRunner: async () => ({ recurring: false, trips: [{ ...raw.trips[0], mentioned: ["departureDate"] }] }),
  });
  expect(result.trips[0]).toMatchObject({ dateLocal: "2026-09-26", timeLocal: null, draft: { departureAt: null } });
});

it("discards unmentioned model locations and rejects unknown places even with valid-looking IDs", async () => {
  const result = await parseOfferDescription({ text: "from Atlantis", mode: "create" }, {
    ...context, modelRunner: async () => ({ recurring: false, trips: [{ ...raw.trips[0], mentioned: ["origin"],
      draft: { ...raw.trips[0].draft, origin: { cityId: 1, pickupPointId: null, rawText: "Atlantis" } } }] }),
  });
  expect(result.trips[0].draft.origin.cityId).toBeNull();
  expect(result.trips[0].draft.destination.cityId).toBeNull();
});

it.each(["Skopje", "Skopje", "Скопје"])("resolves catalog names in Latin and Cyrillic: %s", async origin => {
  const result = await parseOfferDescription({ text: `${origin} to Битола`, mode: "create" }, {
    ...context, modelRunner: async () => ({ recurring: false, trips: [{ ...raw.trips[0], mentioned: ["origin", "destination"],
      draft: { ...emptyOfferDraft(), origin: { cityId: 999, pickupPointId: null, rawText: origin }, destination: { cityId: 999, pickupPointId: null, rawText: "Битола" } } }] }),
  });
  expect(result.trips[0].draft).toMatchObject({ origin: { cityId: 1 }, destination: { cityId: 3 } });
});

it("uses exactly one matching saved car but keeps multiple matches unresolved", async () => {
  const car = { id: "20000000-0000-4000-8000-000000000002", make: "Renault", model: "Clio", fuel_type: "petrol" as const, consumption_l_100km: 6, seats_total: 4 };
  const input = { text: "with a clio", mode: "create" as const };
  expect((await parseOfferDescription(input, { ...context, cars: [car] })).trips[0].draft.carId).toBe(car.id);
  expect((await parseOfferDescription(input, { ...context, cars: [car, { ...car, id: "20000000-0000-4000-8000-000000000003" }] })).trips[0].draft.carId).toBeNull();
});

it("rejects recurring schedules and propagates provider failure without generating drafts", async () => {
  await expect(parseOfferDescription({ text: "every weekday", mode: "create" }, { ...context, modelRunner: async () => ({ ...raw, recurring: true }) })).rejects.toThrow("recurring");
  await expect(parseOfferDescription({ text: "skp bt", mode: "create" }, { ...context, modelRunner: async () => { throw new Error("offline"); } })).rejects.toThrow();
});

it("retains an explicit weekday evidenced by the model even if its mention list omitted the date", async () => {
  const result = await parseOfferDescription({ text: "saturday 4pm", mode: "create" }, {
    ...context, modelRunner: async () => ({ recurring: false, trips: [{ ...raw.trips[0], mentioned: ["departureTime"] }] }),
  });
  expect(result.trips[0].draft.departureAt).toBe("2026-09-26T14:00:00.000Z");
});

it("resolves a city plus its landmark but rejects conflicting city/landmark pairs", async () => {
  const parse = (rawText: string) => parseOfferDescription({ text: rawText, mode: "create" }, { ...context,
    pickupPoints: [{ id: 11, city_id: 1, name_en: "Mavrovka", name_mk: "Мавровка", aliases: [] }],
    modelRunner: async () => ({ recurring: false, trips: [{ ...raw.trips[0], mentioned: ["origin"], draft: { ...emptyOfferDraft(), origin: { cityId: 999, pickupPointId: 999, rawText } } }] }),
  });
  expect((await parse("Skopje Mavrovka")).trips[0].draft.origin).toMatchObject({ cityId: 1, pickupPointId: 11 });
  expect((await parse("Bitola Mavrovka")).trips[0].draft.origin.cityId).toBeNull();
});

it("preserves explicitly supplied fuel and consumption for a manual car", async () => {
  const result = await parseOfferDescription({ text: "with a Wartburg petrol consuming 8 L/100km", mode: "create" }, { ...context,
    modelRunner: async () => ({ recurring: false, trips: [{ ...raw.trips[0], mentioned: ["car"], carText: "Wartburg", draft: { ...emptyOfferDraft(),
      car: { carModelId: null, make: "Wartburg", model: "353", fuelType: "petrol", consumptionL100Km: 8, color: null, plateLast3: null, seatsTotal: null } } }] }),
  });
  expect(result.trips[0].draft.car).toMatchObject({ fuelType: "petrol", consumptionL100Km: 8 });
});

it.each(["4 in the morning", "4 nautro", "4 наутро"])("accepts explicit day-period wording: %s", async text => {
  const result = await parseOfferDescription({ text, mode: "create" }, { ...context,
    modelRunner: async () => ({ recurring: false, trips: [{ ...raw.trips[0], mentioned: ["departureTime"], timeLocal: "04:00", timeEvidence: text }] }),
  });
  expect(result.trips[0].timeLocal).toBe("04:00");
});

it.each(["morning", "afternoon", "попладне"])("does not invent an exact hour from %s alone", async text => {
  const result = await parseOfferDescription({ text: `saturday ${text}`, mode: "create" }, { ...context,
    modelRunner: async () => ({ recurring: false, trips: [{ ...raw.trips[0], mentioned: ["departureDate", "departureTime"], timeLocal: "09:00", timeEvidence: text }] }),
  });
  expect(result.trips[0].timeLocal).toBeNull();
});
