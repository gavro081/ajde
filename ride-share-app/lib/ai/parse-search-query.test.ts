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

  it("treats a dateless search as any upcoming departure and ignores seat requests", async () => {
    const result = await parseSearchQuery("Skopje to Bitola for 3 people", {
      candidates,
      modelRunner: async () => ({
        ...baseOutput,
        originText: "Skopje",
        dateLocal: null,
        timeMode: null,
        startTime: null,
        requestedSeats: 3,
        warnings: [
          { field: "departure", code: "unsupported", message: "No date was given." },
          { field: "seats", code: "unsupported", message: "Only one seat can be booked." },
        ],
      }),
    });
    expect(result).toMatchObject({ originId: 1, destinationId: 3, departureAfter: null, departureBefore: null, requestedSeats: null, warnings: [] });
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

  it.each([
    ["after", "17:00", null, "2026-09-21T15:00:00.000Z", "2026-09-21T22:00:00.000Z"],
    ["before", null, "09:00", "2026-09-20T22:00:00.000Z", "2026-09-21T07:00:00.000Z"],
    ["between", "09:00", "17:00", "2026-09-21T07:00:00.000Z", "2026-09-21T15:00:00.000Z"],
  ] as const)("applies a %s time without a date to today", async (timeMode, startTime, endTime, departureAfter, departureBefore) => {
    const result = await parseSearchQuery("Bitola nadvor od rabotno vreme", {
      candidates,
      now: new Date("2026-09-21T10:00:00Z"),
      modelRunner: async () => ({ ...baseOutput, dateLocal: null, timeMode, startTime, endTime }),
    });
    expect(result).toMatchObject({ destinationId: 3, departureAfter, departureBefore, warnings: [] });
  });

  it("uses the Skopje date for today, not the UTC date", async () => {
    // 23:30 UTC on the 21st is already 01:30 on the 22nd in Skopje.
    const result = await parseSearchQuery("Bitola after work", {
      candidates,
      now: new Date("2026-09-21T23:30:00Z"),
      modelRunner: async () => ({ ...baseOutput, dateLocal: null, timeMode: "after", startTime: "17:00" }),
    });
    expect(result.departureAfter).toBe("2026-09-22T15:00:00.000Z");
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
