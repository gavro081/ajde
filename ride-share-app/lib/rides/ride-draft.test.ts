import { describe, expect, it } from "vitest";

import {
  createPublishableRideDraftSchema,
  importedRideDraftSchema,
  type RideDraft,
} from "./ride-draft";

const NOW = new Date("2026-09-20T10:00:00+02:00");
const CAR_ID = "8cf6b8f1-ef8b-4eef-b3ff-6e131648ed47";

function validDraft(overrides: Partial<RideDraft> = {}): RideDraft {
  return {
    source: "native",
    importId: null,
    origin: { cityId: 1, pickupPointId: 1, rawText: null },
    destination: { cityId: 3, pickupPointId: null, rawText: null },
    departureAt: "2026-09-21T08:00:00+02:00",
    distanceKm: 170,
    seatsTotal: 3,
    carId: CAR_ID,
    car: null,
    pricePerSeatMkd: 500,
    notes: null,
    tags: ["no_smoking"],
    genderPreference: "any",
    confidence: null,
    fieldConfidence: [],
    warnings: [],
    ...overrides,
  };
}

const publishableSchema = createPublishableRideDraftSchema({ now: NOW });

describe("rideDraftSchema", () => {
  it("accepts an incomplete imported draft for user review", () => {
    const result = importedRideDraftSchema.safeParse({
      ...validDraft(),
      source: "imported",
      importId: null,
      origin: { cityId: null, pickupPointId: null, rawText: "od Skopje" },
      destination: { cityId: null, pickupPointId: null, rawText: "za doma" },
      departureAt: null,
      seatsTotal: null,
      carId: null,
      pricePerSeatMkd: null,
      genderPreference: null,
      confidence: 0.45,
      warnings: [
        {
          field: "destination",
          code: "ambiguous",
          message: "The destination was not explicit",
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe("createPublishableRideDraftSchema", () => {
  it("accepts a complete valid ride", () => {
    expect(publishableSchema.safeParse(validDraft()).success).toBe(true);
  });

  it("rejects missing required publish fields", () => {
    const result = publishableSchema.safeParse(
      validDraft({
        origin: { cityId: null, pickupPointId: null, rawText: null },
        departureAt: null,
        seatsTotal: null,
        carId: null,
        pricePerSeatMkd: null,
        genderPreference: null,
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining([
          "origin.cityId",
          "departureAt",
          "seatsTotal",
          "carId",
          "genderPreference",
        ]),
      );
      expect(result.error.issues.map((issue) => issue.path.join("."))).not.toContain("pricePerSeatMkd");
    }
  });

  it("publishes a ride without a price as free (0 MKD)", () => {
    const result = publishableSchema.safeParse(validDraft({ pricePerSeatMkd: null }));
    expect(result.success && result.data.pricePerSeatMkd).toBe(0);
  });

  it("rejects a route whose origin and destination are the same", () => {
    const result = publishableSchema.safeParse(
      validDraft({ destination: { cityId: 1, pickupPointId: null, rawText: null } }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["destination", "cityId"] }),
        ]),
      );
    }
  });

  it("rejects a departure that is not in the future", () => {
    const result = publishableSchema.safeParse(
      validDraft({ departureAt: "2026-09-20T10:00:00+02:00" }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({ path: ["departureAt"] });
    }
  });

  it.each([0, 9, 2.5])("rejects an invalid seat count: %s", (seatsTotal) => {
    expect(publishableSchema.safeParse(validDraft({ seatsTotal })).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(
      publishableSchema.safeParse(validDraft({ pricePerSeatMkd: -1 })).success,
    ).toBe(false);
  });

  it("accepts a zero price", () => {
    expect(
      publishableSchema.safeParse(validDraft({ pricePerSeatMkd: 0 })).success,
    ).toBe(true);
  });
});
