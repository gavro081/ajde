import { describe, expect, it } from "vitest";

import { searchQueryResultSchema } from "../ai/search-query-schema";

import {
  clearSearchParams,
  departureBoundsForFilters,
  manualFilterParams,
  matchesDepartureTime,
  parseRideFilters,
  searchResultParams,
} from "./ride-filters";
import { localDayUtcBounds } from "./skopje-time";

describe("ride feed filters", () => {
  it("preserves origin, destination and date, and ignores legacy seat URLs", () => {
    expect(
      parseRideFilters({ origin: "1", destination: "3", date: "2026-09-21", seats: "2" }),
    ).toEqual({
      origin: 1,
      destination: 3,
      date: "2026-09-21",
      dateTo: null, timeAfter: null, timeBefore: null,
      departureAfter: null,
      departureBefore: null,
      sameGenderOnly: false,
    });
  });

  it("parses validated bounds and an explicit same-gender toggle", () => {
    expect(
      parseRideFilters({
        after: "2026-09-25T14:00:00Z",
        before: "2026-09-25T22:00:00+02:00",
        sameGender: "1",
      }),
    ).toMatchObject({
      departureAfter: "2026-09-25T14:00:00.000Z",
      departureBefore: "2026-09-25T20:00:00.000Z",
      sameGenderOnly: true,
    });
  });

  it("falls back safely for malformed values and invalid ranges", () => {
    expect(
      parseRideFilters({
        origin: "-1",
        destination: "x",
        date: "2026-02-30",
        seats: "99",
        after: "2026-09-26T12:00:00Z",
        before: "2026-09-25T12:00:00Z",
        sameGender: "yes",
      }),
    ).toEqual({
      origin: null,
      destination: null,
      date: null,
      dateTo: null, timeAfter: null, timeBefore: null,
      departureAfter: null,
      departureBefore: null,
      sameGenderOnly: false,
    });
  });

  it("treats a missing date as every upcoming departure", () => {
    const now = new Date("2026-09-21T10:00:00Z");
    const filters = parseRideFilters({ origin: "1", date: "" });
    expect(filters.date).toBeNull();
    expect(departureBoundsForFilters(filters, now)).toEqual({ after: now.toISOString(), before: null });
  });

  it("never includes departed rides when a past date is supplied", () => {
    const filters = parseRideFilters({ date: "2026-09-20" });
    expect(departureBoundsForFilters(filters, new Date("2026-09-21T10:00:00Z"))).toEqual({
      after: "2026-09-21T10:00:00.000Z",
      before: "2026-09-20T22:00:00.000Z",
    });
  });

  it("uses manual dates instead of earlier natural-language bounds", () => {
    const filters = parseRideFilters({
      date: "2026-09-26",
      after: "2026-09-25T14:00:00Z",
      before: "2026-09-25T20:00:00Z",
    });
    expect(departureBoundsForFilters(filters, new Date("2026-09-21T10:00:00Z"))).toEqual({
      after: "2026-09-25T22:00:00.000Z",
      before: "2026-09-26T22:00:00.000Z",
    });
  });
});

describe("Skopje calendar boundaries", () => {
  it("uses a 23-hour day when daylight-saving time starts", () => {
    expect(localDayUtcBounds("2026-03-29", "Europe/Skopje")).toEqual({
      start: "2026-03-28T23:00:00.000Z",
      end: "2026-03-29T22:00:00.000Z",
    });
  });

  it("uses a 25-hour day when daylight-saving time ends", () => {
    expect(localDayUtcBounds("2026-10-25", "Europe/Skopje")).toEqual({
      start: "2026-10-24T22:00:00.000Z",
      end: "2026-10-25T23:00:00.000Z",
    });
  });
});

describe("search precedence", () => {
  const result = searchQueryResultSchema.parse({
    originId: null,
    destinationId: 3,
    departureAfter: "2026-09-25T14:00:00Z",
    departureBefore: null,
    requestedSeats: 2,
    confidence: 0.9,
    warnings: [],
  });

  it("replaces route and time filters, drops legacy seats, and preserves same-gender choice", () => {
    const params = searchResultParams(
      new URLSearchParams("origin=1&destination=2&date=2026-09-22&seats=4&sameGender=1"),
      "Bitola Friday after 4",
      result,
    );
    expect(params.get("origin")).toBeNull();
    expect(params.get("destination")).toBe("3");
    expect(params.get("date")).toBeNull();
    expect(params.get("after")).toBe("2026-09-25T14:00:00Z");
    expect(params.get("seats")).toBeNull();
    expect(params.get("sameGender")).toBe("1");
    expect(params.get("q")).toBe("Bitola Friday after 4");
  });

  it("lets later manual edits override AI-produced bounds", () => {
    const searched = searchResultParams(new URLSearchParams("sameGender=1"), "query", result);
    const manual = manualFilterParams(searched, {
      origin: 1,
      destination: 3,
      date: "2026-09-27",
      sameGenderOnly: true,
    });
    expect(manual.get("date")).toBe("2026-09-27");
    expect(manual.get("after")).toBeNull();
    expect(manual.get("before")).toBeNull();
    expect(manual.get("q")).toBe("query");
  });

  it("clears search interpretation but preserves the independent gender toggle", () => {
    const searched = searchResultParams(new URLSearchParams("sameGender=1"), "query", result);
    const cleared = clearSearchParams(searched);
    expect(cleared.toString()).toBe("sameGender=1");
  });
});

describe("recurring local clock filters", () => {
  it("applies the same time window on every day and excludes its upper boundary", () => {
    const filters = parseRideFilters({ timeAfter: "16:00", timeBefore: "18:00" });
    expect(matchesDepartureTime("2026-09-22T14:00:00Z", filters)).toBe(true);
    expect(matchesDepartureTime("2026-09-23T15:00:00Z", filters)).toBe(true);
    expect(matchesDepartureTime("2026-09-23T08:00:00Z", filters)).toBe(false);
    expect(matchesDepartureTime("2026-09-24T16:00:00Z", filters)).toBe(false);
  });
  it("follows the local clock across DST", () => {
    const filters = parseRideFilters({ timeAfter: "16:00", timeBefore: "18:00" });
    expect(matchesDepartureTime("2026-10-24T14:30:00Z", filters)).toBe(true);
    expect(matchesDepartureTime("2026-10-25T14:30:00Z", filters)).toBe(false);
    expect(matchesDepartureTime("2026-10-25T15:30:00Z", filters)).toBe(true);
  });
  it("matches both sides of an overnight window, not noon", () => {
    const filters = parseRideFilters({ timeAfter: "22:00", timeBefore: "02:00" });
    expect(matchesDepartureTime("2026-09-22T21:00:00Z", filters)).toBe(true);
    expect(matchesDepartureTime("2026-09-22T23:00:00Z", filters)).toBe(true);
    expect(matchesDepartureTime("2026-09-22T10:00:00Z", filters)).toBe(false);
  });
  it("supports inclusive date ranges and upper-date-only searches", () => {
    const now = new Date("2026-09-21T10:00:00Z");
    expect(departureBoundsForFilters(parseRideFilters({ date: "2026-09-22", dateTo: "2026-09-24" }), now))
      .toEqual({ after: "2026-09-21T22:00:00.000Z", before: "2026-09-24T22:00:00.000Z" });
    expect(departureBoundsForFilters(parseRideFilters({ dateTo: "2026-09-24" }), now).after).toBe(now.toISOString());
  });
  it("round-trips independent filters and clears stale values on a new search", () => {
    const result = searchQueryResultSchema.parse({ originId: null, destinationId: 8,
      departureAfter: null, departureBefore: null, requestedSeats: null, confidence: 1, warnings: [],
      dateFrom: null, dateTo: null, timeAfter: "16:00", timeBefore: "18:00" });
    const params = searchResultParams(new URLSearchParams("dateTo=2026-09-30&timeAfter=09:00"), "Ohrid around 5", result);
    expect(parseRideFilters(Object.fromEntries(params))).toMatchObject({ date: null, dateTo: null, timeAfter: "16:00", timeBefore: "18:00" });
    expect(clearSearchParams(params).toString()).toBe("");
  });
  it("rejects malformed clock values and handles one-sided windows", () => {
    expect(parseRideFilters({ timeAfter: "25:00", timeBefore: "abc" })).toMatchObject({ timeAfter: null, timeBefore: null });
    expect(matchesDepartureTime("2026-09-22T15:00:00Z", parseRideFilters({ timeAfter: "16:00" }))).toBe(true);
    expect(matchesDepartureTime("2026-09-22T15:00:00Z", parseRideFilters({ timeBefore: "16:00" }))).toBe(false);
  });
});
