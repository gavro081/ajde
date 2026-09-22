import { describe, expect, it } from "vitest";

import { explainMatch, type ExplainRideFact } from "./explain-match";
import {
  explanationRideMatchesContext,
  shouldApplyExplanationResponse,
} from "./explain-match-schema";
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
      return batch.map((ride) => ({ rideId: ride.rideId, explanation: `This ride goes to ${ride.to}.` }));
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

  it("excludes server-reloaded rides that no longer match the search context", () => {
    expect(
      explanationRideMatchesContext(
        {
          origin_city_id: 1,
          dest_city_id: 3,
          departure_at: "2026-09-25T16:00:00Z",
          seats_available: 2,
        },
        context,
      ),
    ).toBe(true);
    expect(
      explanationRideMatchesContext(
        {
          origin_city_id: 1,
          dest_city_id: 4,
          departure_at: "2026-09-25T16:00:00Z",
          seats_available: 2,
        },
        context,
      ),
    ).toBe(false);
  });
});

describe("explanations for daily time windows", () => {
  // Reported bug: a 17:00 Skopje departure (15:00 UTC) was explained as "before the requested
  // timeAfter of 17:00" because the model received a UTC instant next to a local clock time.
  const gostivarRide: ExplainRideFact = {
    rideId: "40000000-0000-4000-8000-000000000003",
    originCityId: 10,
    originName: "Gostivar",
    destinationCityId: 1,
    destinationName: "Skopje",
    departureAt: "2026-09-27T15:00:00+00:00",
    seatsAvailable: 3,
    pricePerSeatMkd: 250,
  };
  const afterFive: SearchQueryResult = {
    originId: 10,
    destinationId: 1,
    departureAfter: null,
    departureBefore: null,
    dateFrom: null,
    dateTo: null,
    timeAfter: "17:00",
    timeBefore: null,
    requestedSeats: null,
    confidence: 0.9,
    warnings: [],
  };
  const answer = (explanation: string) => async () => [{ rideId: gostivarRide.rideId, explanation }];

  it("sends the model readable Skopje-local facts without IDs or UTC instants", async () => {
    let sent: unknown;
    await explainMatch([gostivarRide], afterFive, async (input) => { sent = input; return []; });
    expect(sent).toEqual({
      search: { from: "Gostivar", to: "Skopje", dates: null, dailyTime: "at or after 17:00" },
      rides: [{ rideId: gostivarRide.rideId, from: "Gostivar", to: "Skopje", departs: "Sun 27 Sept at 17:00", seatsAvailable: 3, price: "250 MKD per seat" }],
    });
    expect(JSON.stringify(sent)).not.toMatch(/CityId|15:00|T\d{2}:/);
  });

  it("describes overnight windows and date ranges", async () => {
    let sent: { search: unknown } | undefined;
    await explainMatch([gostivarRide], { ...afterFive, timeBefore: "09:00", dateFrom: "2026-09-26", dateTo: "2026-09-28" },
      async (input) => { sent = input; return []; });
    expect(sent?.search).toMatchObject({ dates: "Sat 26 Sept to Mon 28 Sept", dailyTime: "17:00–09:00 (overnight)" });
  });

  it.each([
    ["the reported contradiction", "Matches the route from Gostivar (10) to Skopje (1), but its departure at 15:00 is before the requested timeAfter of 17:00."],
    ["a claim that it does not match", "Gostivar to Skopje on Sunday does not match your time."],
    ["a UTC-converted time", "Gostivar to Skopje, leaving Sunday at 15:00."],
    ["an internal field name", "Gostivar to Skopje, after your timeAfter."],
  ])("replaces %s with the factual template", async (_, explanation) => {
    const [result] = await explainMatch([gostivarRide], afterFive, answer(explanation));
    expect(result.explanation).toBe("Matches because it leaves from Gostivar, goes to Skopje, departs Sun 27 Sept at 17:00.");
  });

  it("keeps a correct explanation that uses the local time", async () => {
    const explanation = "Gostivar to Skopje on Sun 27 Sept at 17:00, right at the start of your evening window.";
    const [result] = await explainMatch([gostivarRide], afterFive, answer(explanation));
    expect(result.explanation).toBe(explanation);
  });

  it("only explains rides inside the daily window, comparing instants not strings", () => {
    const ride = { origin_city_id: 10, dest_city_id: 1, departure_at: "2026-09-27T15:00:00+00:00", seats_available: 3 };
    expect(explanationRideMatchesContext(ride, afterFive)).toBe(true);
    expect(explanationRideMatchesContext({ ...ride, departure_at: "2026-09-27T14:59:00+00:00" }, afterFive)).toBe(false);
    expect(explanationRideMatchesContext(ride, { ...afterFive, departureAfter: "2026-09-27T15:00:00.000Z" })).toBe(true);
  });
});

describe("free rides in explanations", () => {
  const free: ExplainRideFact = { ...rides[0], pricePerSeatMkd: 0 };

  it("tells the model and the fallback that a 0 MKD ride is free", async () => {
    let sent: { rides: readonly { price: string }[] } | undefined;
    const [result] = await explainMatch([free], { ...context, requestedSeats: null, departureAfter: null, departureBefore: null },
      async (input) => { sent = input; return []; });
    expect(sent?.rides[0].price).toBe("free of charge");
    expect(result.explanation).toBe("Matches because it goes to Bitola, is free of charge.");
  });
});
