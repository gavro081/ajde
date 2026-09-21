import { describe, expect, it } from "vitest";

import {
  parseSearchQuery,
  SearchParserError,
  type SearchLocationCandidate,
  type SearchModelOutput,
} from "./parse-search-query";

const candidates: SearchLocationCandidate[] = [
  { kind: "city", id: 1, cityId: null, nameMk: "Скопје", nameEn: "Skopje", aliases: ["skopje", "shkup"] },
  { kind: "city", id: 3, cityId: null, nameMk: "Битола", nameEn: "Bitola", aliases: ["bitola"] },
  { kind: "pickup_point", id: 11, cityId: 1, nameMk: "Мавровка", nameEn: "Mavrovka", aliases: ["mavrovka", "кај мавровка"] },
];

const baseOutput: SearchModelOutput = {
  originText: null,
  destinationText: "Bitola",
  dateLocal: "2026-09-25",
  timeMode: "after",
  startTime: "16:00",
  endTime: null,
  requestedSeats: null,
  confidence: 0.9,
  warnings: [],
};

describe("natural-language search parsing", () => {
  it("resolves Bitola Friday after 4 with a fixed clock and no origin invention", async () => {
    const result = await parseSearchQuery("Bitola Friday after 4", {
      candidates,
      now: new Date("2026-09-21T10:00:00Z"),
      modelRunner: async () => baseOutput,
    });

    expect(result).toMatchObject({
      originId: null,
      destinationId: 3,
      departureAfter: "2026-09-25T14:00:00.000Z",
      departureBefore: "2026-09-25T22:00:00.000Z",
    });
  });

  it("turns a date-only interpretation into the complete local day", async () => {
    const result = await parseSearchQuery("Bitola Friday", {
      candidates,
      modelRunner: async () => ({
        ...baseOutput,
        timeMode: "day",
        startTime: null,
      }),
    });
    expect(result.departureAfter).toBe("2026-09-24T22:00:00.000Z");
    expect(result.departureBefore).toBe("2026-09-25T22:00:00.000Z");
  });

  it("maps a landmark to its canonical parent city", async () => {
    const result = await parseSearchQuery("from Mavrovka to Bitola", {
      candidates,
      modelRunner: async () => ({ ...baseOutput, originText: "Mavrovka" }),
    });
    expect(result.originId).toBe(1);
    expect(result.destinationId).toBe(3);
  });

  it("keeps unknown locations null and adds a review warning", async () => {
    const result = await parseSearchQuery("Atlantis Friday", {
      candidates,
      modelRunner: async () => ({ ...baseOutput, destinationText: "Atlantis" }),
    });
    expect(result.destinationId).toBeNull();
    expect(result.warnings.some((warning) => warning.field === "destination")).toBe(true);
  });

  it("rejects fabricated IDs returned by the location fallback", async () => {
    const result = await parseSearchQuery("somewhere Friday", {
      candidates,
      modelRunner: async () => ({ ...baseOutput, destinationText: "somewhere" }),
      locationFallback: async () => ({ kind: "city", candidateId: 9999, confidence: 0.99 }),
    });
    expect(result.destinationId).toBeNull();
  });

  it("does not convert unsupported passenger preferences into filters", async () => {
    const result = await parseSearchQuery("Bitola Friday women only", {
      candidates,
      modelRunner: async () => ({
        ...baseOutput,
        warnings: [{ field: null, code: "unsupported", message: "Passenger preferences are not inferred." }],
      }),
    });
    expect(result).not.toHaveProperty("sameGenderOnly");
    expect(result.warnings[0]?.code).toBe("unsupported");
  });

  it("classifies provider failures without weakening manual search", async () => {
    await expect(
      parseSearchQuery("Bitola Friday", {
        candidates,
        modelRunner: async () => {
          throw new Error("offline");
        },
      }),
    ).rejects.toMatchObject({ code: "provider_error" } satisfies Partial<SearchParserError>);
  });
});
