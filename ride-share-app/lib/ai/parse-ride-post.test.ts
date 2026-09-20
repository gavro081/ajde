import { describe, expect, it } from "vitest";

import fixtures from "../../fixtures/posts/posts.json";

import {
  parseRidePost,
  removeDepartureWithoutTime,
  resolveParsedLocations,
  stubParseRidePost,
  validateCanonicalLocations,
} from "./parse-ride-post";

describe("parseRidePost", () => {
  it("fails explicitly while no provider is configured", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      await expect(
        parseRidePost("Skopje to Bitola", { cities: [], pickupPoints: [] }),
      ).rejects.toMatchObject({ code: "missing_key" });
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });
});

describe("validateCanonicalLocations", () => {
  it("removes invented and city-mismatched IDs", () => {
    const parsed = stubParseRidePost(fixtures[0].text);
    parsed.draft.origin.cityId = 999;
    parsed.draft.origin.pickupPointId = 1;
    parsed.draft.destination.pickupPointId = 1;

    const validated = validateCanonicalLocations(parsed, {
      cities: [
        { id: 1, nameMk: "Скопје", nameEn: "Skopje", aliases: [] },
        { id: 3, nameMk: "Битола", nameEn: "Bitola", aliases: [] },
      ],
      pickupPoints: [
        { id: 1, cityId: 1, nameMk: "Мавровка", nameEn: "Mavrovka", aliases: [] },
      ],
    });

    expect(validated.draft.origin).toMatchObject({ cityId: null, pickupPointId: null });
    expect(validated.draft.destination.pickupPointId).toBeNull();
    expect(validated.draft.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "needs_review" })]),
    );
  });
});

describe("resolveParsedLocations", () => {
  it("replaces model IDs with deterministic canonical matches from raw place text", async () => {
    const parsed = stubParseRidePost(fixtures[0].text);
    parsed.draft.origin = { cityId: 999, pickupPointId: 999, rawText: "кај Мавровка" };
    parsed.draft.destination = { cityId: 1, pickupPointId: null, rawText: "Битола" };

    const resolved = await resolveParsedLocations(parsed, {
      cities: [
        { id: 1, nameMk: "Скопје", nameEn: "Skopje", aliases: ["skopje"] },
        { id: 3, nameMk: "Битола", nameEn: "Bitola", aliases: ["bitola"] },
      ],
      pickupPoints: [
        {
          id: 1,
          cityId: 1,
          nameMk: "Мавровка",
          nameEn: "Mavrovka",
          aliases: ["кај мавровка"],
        },
      ],
    });

    expect(resolved.draft.origin).toMatchObject({ cityId: 1, pickupPointId: 1 });
    expect(resolved.draft.destination).toMatchObject({ cityId: 3, pickupPointId: null });
  });

  it("clears model IDs when raw place text cannot be resolved", async () => {
    const parsed = stubParseRidePost(fixtures[0].text);
    parsed.draft.origin = { cityId: 1, pickupPointId: null, rawText: "Непознато место" };

    const resolved = await resolveParsedLocations(parsed, {
      cities: [{ id: 1, nameMk: "Скопје", nameEn: "Skopje", aliases: [] }],
      pickupPoints: [],
    });

    expect(resolved.draft.origin).toMatchObject({ cityId: null, pickupPointId: null });
    expect(resolved.draft.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "origin" })]),
    );
  });

  it("resolves one unambiguous canonical place embedded in surrounding raw text", async () => {
    const parsed = stubParseRidePost(fixtures[0].text);
    parsed.draft.destination = {
      cityId: 999,
      pickupPointId: null,
      rawText: "до Битола утре",
    };

    const resolved = await resolveParsedLocations(parsed, {
      cities: [
        { id: 1, nameMk: "Скопје", nameEn: "Skopje", aliases: [] },
        { id: 3, nameMk: "Битола", nameEn: "Bitola", aliases: [] },
      ],
      pickupPoints: [],
    });

    expect(resolved.draft.destination.cityId).toBe(3);
  });

  it("prefers an embedded pickup when all embedded places belong to the same city", async () => {
    const parsed = stubParseRidePost(fixtures[0].text);
    parsed.draft.origin = {
      cityId: 999,
      pickupPointId: 999,
      rawText: "Skopje kaj Mavrovka",
    };

    const resolved = await resolveParsedLocations(parsed, {
      cities: [{ id: 1, nameMk: "Скопје", nameEn: "Skopje", aliases: [] }],
      pickupPoints: [
        {
          id: 1,
          cityId: 1,
          nameMk: "Мавровка",
          nameEn: "Mavrovka",
          aliases: [],
        },
      ],
    });

    expect(resolved.draft.origin).toMatchObject({ cityId: 1, pickupPointId: 1 });
  });
});

describe("removeDepartureWithoutTime", () => {
  it("clears a model-invented time when the post supplied only a date", () => {
    const parsed = stubParseRidePost(fixtures[3].text);
    parsed.draft.departureAt = "2026-09-25T00:00:00+02:00";

    const guarded = removeDepartureWithoutTime(fixtures[3].text, parsed);

    expect(guarded.draft.departureAt).toBeNull();
    expect(guarded.draft.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "departureAt" })]),
    );
  });
});

describe("stubParseRidePost", () => {
  it.each(fixtures)("matches the fixture contract: $name", ({ text, expected }) => {
    const parsed = stubParseRidePost(text);

    expect(parsed.classification).toBe(expected.classification);
    expect(parsed.draft.origin.cityId).toBe(expected.originCityId);
    expect(parsed.draft.destination.cityId).toBe(expected.destinationCityId);
    expect(parsed.draft.seatsTotal).toBe(expected.seats);
    expect(parsed.draft.pricePerSeatMkd).toBe(expected.price);
  });
});
