import { describe, expect, it } from "vitest";

import { parseRideFilters } from "./ride-filters";

describe("ride feed filters", () => {
  it("parses valid filters", () => {
    expect(parseRideFilters({ origin: "1", destination: "3", date: "2026-09-21", seats: "2" })).toEqual({ origin: 1, destination: 3, date: "2026-09-21", seats: 2 });
  });

  it("falls back safely for malformed query values", () => {
    expect(parseRideFilters({ origin: "-1", destination: "x", date: "tomorrow", seats: "99" })).toEqual({ origin: null, destination: null, date: null, seats: 1 });
  });
});
