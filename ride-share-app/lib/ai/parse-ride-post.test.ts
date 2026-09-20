import { describe, expect, it } from "vitest";

import fixtures from "../../fixtures/posts/posts.json";

import { ParserUnavailableError, parseRidePost, stubParseRidePost } from "./parse-ride-post";

describe("parseRidePost", () => {
  it("fails explicitly while no provider is configured", async () => {
    await expect(parseRidePost("Skopje to Bitola")).rejects.toBeInstanceOf(
      ParserUnavailableError,
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
