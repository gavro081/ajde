import { describe, expect, it } from "vitest";

import { explainMatch, type ExplainRideFact } from "./explain-match";
import { shouldApplyExplanationResponse } from "./explain-match-schema";
import type { SearchQueryResult } from "./search-query-schema";

const context: SearchQueryResult = {
  originId: null,
  destinationId: 3,
  departureAfter: "2026-09-25T14:00:00Z",
  departureBefore: "2026-09-25T22:00:00Z",
  requestedSeats: 2,
  confidence: 0.9,
  warnings: [],
};

const rides: ExplainRideFact[] = [
  {
    rideId: "40000000-0000-4000-8000-000000000001",
    originCityId: 1,
    originName: "Skopje",
    destinationCityId: 3,
    destinationName: "Bitola",
    departureAt: "2026-09-25T16:00:00Z",
    seatsAvailable: 3,
    pricePerSeatMkd: 400,
  },
  {
    rideId: "40000000-0000-4000-8000-000000000002",
    originCityId: 2,
    originName: "Kumanovo",
    destinationCityId: 3,
    destinationName: "Bitola",
    departureAt: "2026-09-25T18:00:00Z",
    seatsAvailable: 2,
    pricePerSeatMkd: null,
  },
];

describe("batched match explanations", () => {
  it("makes one model call for the complete batch", async () => {
    let calls = 0;
    const result = await explainMatch(rides, context, async ({ rides: batch }) => {
      calls += 1;
      return batch.map((ride) => ({ rideId: ride.rideId, explanation: `This ride goes to ${ride.destinationName}.` }));
    });
    expect(calls).toBe(1);
    expect(result).toHaveLength(2);
  });

  it("does not call the provider for empty results", async () => {
    let calls = 0;
    expect(await explainMatch([], context, async () => { calls += 1; return []; })).toEqual([]);
    expect(calls).toBe(0);
  });

  it("discards mismatched IDs and uses a factual template", async () => {
    const result = await explainMatch(rides.slice(0, 1), context, async () => [{
      rideId: "40000000-0000-4000-8000-000000009999",
      explanation: "This ride goes to Bitola.",
    }]);
    expect(result[0]?.rideId).toBe(rides[0]?.rideId);
    expect(result[0]?.explanation).toContain("goes to Bitola");
  });

  it("rejects duplicate explanations for the same ride", async () => {
    const result = await explainMatch(rides.slice(0, 1), context, async () => [
      { rideId: rides[0].rideId, explanation: "This ride goes to Bitola at the requested time." },
      { rideId: rides[0].rideId, explanation: "Another explanation for Bitola." },
    ]);
    expect(result[0]?.explanation).toContain("3 seats available");
  });

  it("rejects invented safety facts", async () => {
    const result = await explainMatch(rides.slice(0, 1), context, async () => [{
      rideId: rides[0].rideId,
      explanation: "A verified and safe driver is going to Bitola.",
    }]);
    expect(result[0]?.explanation).not.toMatch(/verified|safe/i);
    expect(result[0]?.explanation).toContain("3 seats available");
  });

  it("falls back locally when the provider fails", async () => {
    const result = await explainMatch(rides.slice(0, 1), context, async () => {
      throw new Error("provider unavailable");
    });
    expect(result[0]?.explanation).toContain("Bitola");
  });

  it("ignores a response after the search context changes", () => {
    expect(shouldApplyExplanationResponse("query-a", "query-b")).toBe(false);
    expect(shouldApplyExplanationResponse("query-b", "query-b")).toBe(true);
  });
});
