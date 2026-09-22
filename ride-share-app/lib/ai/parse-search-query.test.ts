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
  dateEndLocal: null,
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
      departureAfter: "2026-09-24T22:00:00.000Z",
      timeAfter: "16:00",
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

describe("independent search dates and times", () => {
  const parse = (fields: Partial<SearchModelOutput>) => parseSearchQuery("search", {
    candidates, modelRunner: async () => ({ ...baseOutput, ...fields }),
  });

  it("keeps a time without inventing or requiring a date", async () => {
    expect(await parse({ dateLocal: null })).toMatchObject({
      departureAfter: null, departureBefore: null, timeAfter: "16:00", timeBefore: null, warnings: [],
    });
  });

  it("keeps a recurring around-time separate from a relative range", async () => {
    const result = await parse({ dateLocal: "2026-09-22", dateEndLocal: "2026-09-24", timeMode: "around", startTime: "17:00" });
    expect(result).toMatchObject({ dateFrom: "2026-09-22", dateTo: "2026-09-24",
      departureAfter: "2026-09-21T22:00:00.000Z", departureBefore: "2026-09-24T22:00:00.000Z",
      timeAfter: "16:00", timeBefore: "18:00", warnings: [] });
  });

  it("handles an around-midnight window without attaching it to one date", async () => {
    expect(await parse({ dateLocal: null, timeMode: "around", startTime: "00:30" }))
      .toMatchObject({ timeAfter: "23:30", timeBefore: "01:30", departureAfter: null });
  });

  it("uses calendar boundaries across daylight-saving changes", async () => {
    expect(await parse({ dateLocal: "2026-10-24", dateEndLocal: "2026-10-26" })).toMatchObject({
      departureAfter: "2026-10-23T22:00:00.000Z", departureBefore: "2026-10-26T23:00:00.000Z", timeAfter: "16:00",
    });
  });

  it("supports before-only and overnight times", async () => {
    expect(await parse({ dateLocal: null, timeMode: "before", startTime: null, endTime: "09:00" }))
      .toMatchObject({ timeAfter: null, timeBefore: "09:00" });
    expect(await parse({ timeMode: "between", startTime: "22:00", endTime: "02:00" }))
      .toMatchObject({ timeAfter: "22:00", timeBefore: "02:00" });
  });

  it("rejects reversed dates, invalid dates, and empty time windows", async () => {
    for (const fields of [
      { dateEndLocal: "2026-09-24" }, { dateLocal: "2026-02-30" },
      { timeMode: "between" as const, startTime: "16:00", endTime: "16:00" },
    ]) await expect(parse(fields)).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("warns about incomplete times while keeping the date range", async () => {
    expect(await parse({ startTime: null })).toMatchObject({
      dateFrom: "2026-09-25", timeAfter: null, timeBefore: null,
      warnings: [expect.objectContaining({ code: "needs_review" })],
    });
  });
});
