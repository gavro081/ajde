import { describe, expect, it } from "vitest";

import { zonedDateTimeToUtc } from "../rides/skopje-time";
import { searchQueryResultSchema } from "./search-query-schema";

describe("search query result contract", () => {
  it("represents unknown places and omitted fields as null", () => {
    expect(
      searchQueryResultSchema.parse({
        originId: null,
        destinationId: null,
        departureAfter: null,
        departureBefore: null,
        requestedSeats: null,
        confidence: 0.25,
        warnings: [
          {
            field: "destination",
            code: "needs_review",
            message: "Choose a destination manually.",
          },
        ],
      }),
    ).toMatchObject({ originId: null, destinationId: null, requestedSeats: null });
  });

  it("rejects an invalid departure range", () => {
    expect(
      searchQueryResultSchema.safeParse({
        originId: null,
        destinationId: 3,
        departureAfter: "2026-09-25T18:00:00Z",
        departureBefore: "2026-09-25T17:00:00Z",
        requestedSeats: null,
        confidence: 0.8,
        warnings: [],
      }).success,
    ).toBe(false);
  });

  it("converts Friday after 16:00 using the explicit Skopje timezone", () => {
    const fixedFriday = "2026-09-25";
    expect(zonedDateTimeToUtc(fixedFriday, 16, 0, "Europe/Skopje")).toBe(
      "2026-09-25T14:00:00.000Z",
    );
  });
});
