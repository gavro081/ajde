import { describe, expect, it } from "vitest";

import type { SearchQueryResult } from "../ai/search-query-schema";
import {
  clearSearchParams,
  decodeSearchInterpretation,
  departureBoundsForFilters,
  manualFilterParams,
  parseRideFilters,
  searchResultParams,
  type RideFilters,
} from "./ride-filters";

const noFilters: RideFilters = {
  origin: null,
  destination: null,
  date: null,
  departureAfter: null,
  departureBefore: null,
  sameGenderOnly: false,
};

const interpretation: SearchQueryResult = {
  originId: 3,
  destinationId: 8,
  departureAfter: "2026-09-22T09:00:00.000Z",
  departureBefore: "2026-09-22T22:00:00.000Z",
  requestedSeats: null,
  confidence: 0.9,
  warnings: [],
};

describe("parseRideFilters", () => {
  it("reads valid URL filters", () => {
    expect(parseRideFilters({
      origin: "1",
      destination: ["3", "8"],
      date: "2026-09-22",
      after: "2026-09-22T09:00:00+02:00",
      before: "2026-09-22T20:00:00Z",
      sameGender: "true",
    })).toEqual({
      origin: 1,
      destination: 3,
      date: "2026-09-22",
      departureAfter: "2026-09-22T07:00:00.000Z",
      departureBefore: "2026-09-22T20:00:00.000Z",
      sameGenderOnly: true,
    });
  });

  it.each(["0", "-2", "1.5", "abc", ""])("rejects the non-positive or non-integer city id %j", (value) => {
    expect(parseRideFilters({ origin: value, destination: value })).toMatchObject({ origin: null, destination: null });
  });

  it.each(["2026-02-30", "2026-13-01", "22-09-2026", "2026-9-22"])("rejects the invalid calendar date %j", (date) => {
    expect(parseRideFilters({ date }).date).toBeNull();
  });

  it("accepts a leap day only in a leap year", () => {
    expect(parseRideFilters({ date: "2028-02-29" }).date).toBe("2028-02-29");
    expect(parseRideFilters({ date: "2027-02-29" }).date).toBeNull();
  });

  it("rejects bounds that are not full timestamps", () => {
    expect(parseRideFilters({ after: "2026-09-22", before: "tomorrow" })).toMatchObject({
      departureAfter: null,
      departureBefore: null,
    });
  });

  it("drops both bounds when the range is empty or inverted", () => {
    const at = "2026-09-22T10:00:00.000Z";
    expect(parseRideFilters({ after: at, before: at })).toMatchObject({ departureAfter: null, departureBefore: null });
    expect(parseRideFilters({ after: "2026-09-23T10:00:00Z", before: at })).toMatchObject({
      departureAfter: null,
      departureBefore: null,
    });
  });

  it.each([["1", true], ["on", true], ["TRUE", true], ["0", false], ["yes", false], [undefined, false]])(
    "reads sameGender=%j as %s",
    (sameGender, expected) => {
      expect(parseRideFilters({ sameGender }).sameGenderOnly).toBe(expected);
    },
  );
});

describe("departureBoundsForFilters", () => {
  const now = new Date("2026-09-21T10:00:00.000Z");

  it("shows every upcoming departure when no date or time is set", () => {
    expect(departureBoundsForFilters(noFilters, now)).toEqual({ after: now.toISOString(), before: null });
  });

  it("uses the whole Skopje day for a manually picked date", () => {
    expect(departureBoundsForFilters({ ...noFilters, date: "2026-09-22" }, now)).toEqual({
      after: "2026-09-21T22:00:00.000Z",
      before: "2026-09-22T22:00:00.000Z",
    });
  });

  it("lets a picked date override AI-produced bounds", () => {
    expect(departureBoundsForFilters({
      ...noFilters,
      date: "2026-09-25",
      departureAfter: "2026-09-22T09:00:00.000Z",
      departureBefore: "2026-09-22T12:00:00.000Z",
    }, now)).toEqual({ after: "2026-09-24T22:00:00.000Z", before: "2026-09-25T22:00:00.000Z" });
  });

  it("never shows departures that already left, even when today is picked", () => {
    expect(departureBoundsForFilters({ ...noFilters, date: "2026-09-21" }, now)).toEqual({
      after: now.toISOString(),
      before: "2026-09-21T22:00:00.000Z",
    });
  });

  it("clamps a past AI lower bound to now and keeps a future one", () => {
    expect(departureBoundsForFilters({ ...noFilters, departureAfter: "2026-09-20T08:00:00.000Z" }, now).after)
      .toBe(now.toISOString());
    expect(departureBoundsForFilters({ ...noFilters, departureAfter: "2026-09-22T09:00:00.000Z" }, now).after)
      .toBe("2026-09-22T09:00:00.000Z");
  });
});

describe("search URL state", () => {
  it("replaces stale filters with the interpreted search", () => {
    const current = new URLSearchParams("origin=1&date=2026-09-30&seats=2&manual=1&sameGender=1&page=2");
    const next = searchResultParams(current, "  baram prevoz bitola ohrid utre od 11 ", interpretation);

    expect(Object.fromEntries(next)).toEqual({
      sameGender: "1",
      page: "2",
      q: "baram prevoz bitola ohrid utre od 11",
      search: "1",
      origin: "3",
      destination: "8",
      after: "2026-09-22T09:00:00.000Z",
      before: "2026-09-22T22:00:00.000Z",
      interpretation: JSON.stringify(interpretation),
    });
    expect(current.get("origin")).toBe("1");
  });

  it("omits unknown interpreted values and an empty query", () => {
    const next = searchResultParams(new URLSearchParams(), "   ", {
      ...interpretation,
      originId: null,
      departureAfter: null,
      departureBefore: null,
    });
    expect(next.has("q")).toBe(false);
    expect(next.has("origin")).toBe(false);
    expect(next.has("after")).toBe(false);
    expect(next.get("destination")).toBe("8");
  });

  it("round-trips the interpretation through the URL", () => {
    const next = searchResultParams(new URLSearchParams(), "q", interpretation);
    expect(decodeSearchInterpretation(next.get("interpretation") ?? undefined)).toEqual(interpretation);
  });

  it.each([
    ["missing", undefined],
    ["malformed JSON", "{"],
    ["wrong shape", JSON.stringify({ originId: "Bitola" })],
    ["inverted range", JSON.stringify({ ...interpretation, departureAfter: interpretation.departureBefore })],
    ["oversized", JSON.stringify({ ...interpretation, pad: "x".repeat(4_000) })],
  ])("ignores a %s interpretation", (_, value) => {
    expect(decodeSearchInterpretation(value)).toBeNull();
  });

  it("keeps the search text when filters are changed manually", () => {
    const current = new URLSearchParams("q=bitola&search=1&origin=3&after=x&before=y&sameGender=1");
    const next = manualFilterParams(current, { origin: 1, destination: null, date: "2026-09-22", sameGenderOnly: false });
    expect(Object.fromEntries(next)).toEqual({ q: "bitola", search: "1", origin: "1", date: "2026-09-22" });
  });

  it("clears every search and filter key but keeps unrelated params", () => {
    const current = new URLSearchParams("q=a&search=1&interpretation=x&manual=1&origin=1&destination=2&date=d&after=a&before=b&seats=1&sameGender=1");
    expect(Object.fromEntries(clearSearchParams(current))).toEqual({ sameGender: "1" });
  });
});
