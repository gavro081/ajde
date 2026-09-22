import { afterEach, describe, expect, it, vi } from "vitest";

import { emptyOfferDraft, type OfferTrip } from "./offer-interpretation";
import { validateRecoveredTab } from "./offer-recovery";
import { applyOfferTrip, createOfferTab, editOfferTab, type OfferTab } from "./offer-tabs";
import { valuesFromDraft } from "./offer-values";
import type { RideDraft } from "./ride-draft";

const TAB_ID = "11111111-1111-4111-8111-111111111111";
const CAR_ID = "22222222-2222-4222-8222-222222222222";

function draft(overrides: Partial<RideDraft> = {}): RideDraft {
  return { ...emptyOfferDraft(), ...overrides };
}

function skopjeToBitola() {
  return createOfferTab(draft({
    origin: { cityId: 1, pickupPointId: 4, rawText: "Avtokomanda" },
    destination: { cityId: 3, pickupPointId: null, rawText: "Bitola" },
    departureAt: "2026-09-22T15:00:00.000Z",
    distanceKm: 170,
    seatsTotal: 3,
    pricePerSeatMkd: 400,
  }), TAB_ID);
}

function trip(mentioned: OfferTrip["mentioned"], overrides: Partial<RideDraft> = {}, extra: Partial<OfferTrip> = {}): OfferTrip {
  return { draft: draft(overrides), mentioned, dateLocal: null, timeLocal: null, ...extra };
}

describe("valuesFromDraft", () => {
  it("picks the car mode from what the draft knows about the car", () => {
    const car = { carModelId: null, make: "Renault", model: "Clio", fuelType: null, consumptionL100Km: null, color: null, plateLast3: null, seatsTotal: null };
    expect(valuesFromDraft(draft()).carMode).toBe("catalog");
    expect(valuesFromDraft(draft({ carId: CAR_ID })).carMode).toBe("existing");
    expect(valuesFromDraft(draft({ car: { ...car, carModelId: 7 } })).carMode).toBe("catalog");
    expect(valuesFromDraft(draft({ car })).carMode).toBe("manual");
  });
});

describe("createOfferTab", () => {
  it("starts a clean auto distance lookup instead of trusting a provided distance", () => {
    const tab = skopjeToBitola();
    expect(tab).toMatchObject({ id: TAB_ID, revision: 0, distanceEpoch: 0, distanceMode: "auto", publishedId: null });
    expect(tab.values).toMatchObject({ originCityId: "1", originPickupId: "4", destinationCityId: "3", distanceKm: "", departureLocal: "2026-09-22T17:00", seatsTotal: "3" });
  });
});

describe("editOfferTab", () => {
  it("resets the distance when the route changes", () => {
    const tab = { ...skopjeToBitola(), distanceMode: "resolved" as const, distanceMessage: "170 km" };
    const edited = editOfferTab(tab, { ...tab.values, destinationCityId: "8", distanceKm: "170" });
    expect(edited).toMatchObject({ revision: 1, distanceEpoch: 1, distanceMode: "auto", distanceMessage: "" });
    expect(edited.values.distanceKm).toBe("");
  });

  it("treats a typed distance as a manual override", () => {
    const tab = skopjeToBitola();
    const edited = editOfferTab(tab, { ...tab.values, distanceKm: "175" });
    expect(edited).toMatchObject({ distanceEpoch: 1, distanceMode: "manual" });
    expect(edited.values.distanceKm).toBe("175");
  });

  it("keeps the distance state for unrelated edits", () => {
    const tab = { ...skopjeToBitola(), distanceMode: "resolved" as const, distanceMessage: "170 km" };
    const edited = editOfferTab(tab, { ...tab.values, seatsTotal: "2" });
    expect(edited).toMatchObject({ revision: 1, distanceEpoch: 0, distanceMode: "resolved", distanceMessage: "170 km" });
  });
});

describe("applyOfferTrip", () => {
  it("only overwrites the fields the correction mentioned", () => {
    const tab = skopjeToBitola();
    const next = applyOfferTrip(tab, trip(["seatsTotal"], { seatsTotal: 2, pricePerSeatMkd: 999 }));
    expect(next.values).toMatchObject({ seatsTotal: "2", pricePerSeatMkd: "400", originCityId: "1", destinationCityId: "3" });
  });

  it("moves the pickup together with its city", () => {
    const next = applyOfferTrip(skopjeToBitola(), trip(["origin"], { origin: { cityId: 8, pickupPointId: null, rawText: "Ohrid" } }));
    expect(next.values).toMatchObject({ originCityId: "8", originPickupId: "", distanceKm: "" });
    expect(next.distanceMode).toBe("auto");
  });

  it("changes only the departure time and keeps the date", () => {
    const next = applyOfferTrip(skopjeToBitola(), trip(["departureTime"], {}, { timeLocal: "19:30" }));
    expect(next.values.departureLocal).toBe("2026-09-22T19:30");
  });

  it("changes only the departure date and keeps the time", () => {
    const next = applyOfferTrip(skopjeToBitola(), trip(["departureDate"], {}, { dateLocal: "2026-09-25" }));
    expect(next.values.departureLocal).toBe("2026-09-25T17:00");
  });

  it("replaces warnings for corrected fields and keeps the rest", () => {
    const tab: OfferTab = { ...skopjeToBitola(), warnings: [
      { field: "departureAt", code: "needs_review", message: "Time was ambiguous." },
      { field: "car", code: "needs_review", message: "Choose a car." },
      { field: null, code: "low_confidence", message: "General." },
    ] };
    const next = applyOfferTrip(tab, trip(["departureTime"], { warnings: [{ field: "seatsTotal", code: "missing", message: "Seats?" }] }, { timeLocal: "18:00" }));
    expect(next.warnings.map((warning) => warning.message)).toEqual(["Choose a car.", "Seats?"]);
  });
});

describe("validateRecoveredTab", () => {
  const catalog = {
    cities: [{ id: 1 }, { id: 3 }],
    pickupPoints: [{ id: 4, city_id: 1 }],
    cars: [{ id: CAR_ID }],
    carModels: [{ id: 7 }],
  };

  afterEach(() => { vi.useRealTimers(); });

  it("keeps a still-valid recovered draft unchanged apart from a new revision", () => {
    vi.useFakeTimers({ now: new Date("2026-09-21T10:00:00Z") });
    const tab = skopjeToBitola();
    const recovered = validateRecoveredTab(tab, catalog);
    expect(recovered.values).toEqual(tab.values);
    expect(recovered.warnings).toEqual([]);
  });

  it("clears cities, pickups, cars and models that no longer exist", () => {
    vi.useFakeTimers({ now: new Date("2026-09-21T10:00:00Z") });
    const tab = skopjeToBitola();
    const recovered = validateRecoveredTab({ ...tab, values: { ...tab.values,
      destinationCityId: "99", destinationPickupId: "4",
      carMode: "existing", existingCarId: "33333333-3333-4333-8333-333333333333",
      catalogModelId: "8", consumption: "5.5",
    } }, catalog);

    expect(recovered.values).toMatchObject({ originCityId: "1", originPickupId: "4", destinationCityId: "", destinationPickupId: "", existingCarId: "", catalogModelId: "", consumption: "" });
    expect(recovered.warnings.map((warning) => warning.field)).toEqual(["destination", "car", "car"]);
  });

  it("drops a pickup that belongs to a different city", () => {
    vi.useFakeTimers({ now: new Date("2026-09-21T10:00:00Z") });
    const tab = skopjeToBitola();
    const recovered = validateRecoveredTab({ ...tab, values: { ...tab.values, originCityId: "3" } }, catalog);
    expect(recovered.values).toMatchObject({ originCityId: "3", originPickupId: "" });
  });

  it("warns when the recovered departure has already passed", () => {
    vi.useFakeTimers({ now: new Date("2026-09-23T10:00:00Z") });
    const recovered = validateRecoveredTab(skopjeToBitola(), catalog);
    expect(recovered.warnings).toEqual([expect.objectContaining({ field: "departureAt", code: "needs_review" })]);
  });

  it("leaves published tabs alone", () => {
    const tab = { ...skopjeToBitola(), publishedId: "44444444-4444-4444-8444-444444444444", values: { ...skopjeToBitola().values, originCityId: "99" } };
    expect(validateRecoveredTab(tab, catalog)).toBe(tab);
  });
});
