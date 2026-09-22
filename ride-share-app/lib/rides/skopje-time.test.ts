import { describe, expect, it } from "vitest";

import { departureInstant, skopjeLocal } from "./offer-values";
import { localDayUtcBounds, zonedDateTimeToUtc } from "./skopje-time";

const SKOPJE = "Europe/Skopje";

describe("zonedDateTimeToUtc", () => {
  it("applies summer (UTC+2) and winter (UTC+1) offsets", () => {
    expect(zonedDateTimeToUtc("2026-09-22", 17, 0, SKOPJE)).toBe("2026-09-22T15:00:00.000Z");
    expect(zonedDateTimeToUtc("2026-12-22", 17, 0, SKOPJE)).toBe("2026-12-22T16:00:00.000Z");
  });

  it("is correct on both sides of the DST switches", () => {
    // Clocks go forward 2026-03-29 02:00 and back 2026-10-25 03:00 local time.
    expect(zonedDateTimeToUtc("2026-03-29", 1, 30, SKOPJE)).toBe("2026-03-29T00:30:00.000Z");
    expect(zonedDateTimeToUtc("2026-03-29", 3, 30, SKOPJE)).toBe("2026-03-29T01:30:00.000Z");
    expect(zonedDateTimeToUtc("2026-10-25", 1, 30, SKOPJE)).toBe("2026-10-24T23:30:00.000Z");
    expect(zonedDateTimeToUtc("2026-10-25", 4, 0, SKOPJE)).toBe("2026-10-25T03:00:00.000Z");
  });
});

describe("localDayUtcBounds", () => {
  it("covers exactly one local day", () => {
    expect(localDayUtcBounds("2026-09-22", SKOPJE)).toEqual({
      start: "2026-09-21T22:00:00.000Z",
      end: "2026-09-22T22:00:00.000Z",
    });
  });

  it("rolls over month and year ends", () => {
    expect(localDayUtcBounds("2026-12-31", SKOPJE)).toEqual({
      start: "2026-12-30T23:00:00.000Z",
      end: "2026-12-31T23:00:00.000Z",
    });
  });

  it("is 23 and 25 hours long on DST change days", () => {
    const hours = (date: string) => {
      const { start, end } = localDayUtcBounds(date, SKOPJE);
      return (Date.parse(end) - Date.parse(start)) / 3_600_000;
    };
    expect(hours("2026-03-29")).toBe(23);
    expect(hours("2026-10-25")).toBe(25);
  });
});

describe("offer departure conversion", () => {
  it("formats an instant as Skopje wall-clock time", () => {
    expect(skopjeLocal("2026-09-22T15:00:00.000Z")).toBe("2026-09-22T17:00");
    expect(skopjeLocal("2026-09-21T22:30:00.000Z")).toBe("2026-09-22T00:30");
    expect(skopjeLocal(null)).toBe("");
    expect(skopjeLocal("not a date")).toBe("");
  });

  it("round-trips a local departure to an instant", () => {
    const instant = departureInstant("2026-09-22T17:00");
    expect(instant).toBe("2026-09-22T15:00:00.000Z");
    expect(skopjeLocal(instant)).toBe("2026-09-22T17:00");
  });

  it("rejects malformed input and a time skipped by the spring DST jump", () => {
    expect(departureInstant("2026-09-22 17:00")).toBe("");
    expect(departureInstant("2026-09-22T7:00")).toBe("");
    expect(departureInstant("2026-03-29T02:30")).toBe("");
  });
});
