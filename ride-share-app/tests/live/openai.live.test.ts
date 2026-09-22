import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createOpenAILocationFallback } from "@/lib/ai/openai-location-fallback";
import { parseOfferDescription } from "@/lib/ai/parse-offer-description";
import { parseRidePost } from "@/lib/ai/parse-ride-post";
import { parseSearchQuery } from "@/lib/ai/parse-search-query";

import { CITY, cities, parserCities, parserPickupPoints, pickupPoints, searchCandidates } from "./catalog";

// Monday 2026-09-21, 12:00 in Skopje, so "utre" (tomorrow) is Tuesday 2026-09-22
// and "petok" (Friday) is 2026-09-25. Skopje is UTC+2 on all of these dates.
const now = new Date("2026-09-21T10:00:00.000Z");
const TOMORROW_17H = "2026-09-22T15:00:00.000Z";

/** The importer keeps the model's offset (e.g. +02:00), so compare instants rather than strings. */
function instant(value: string | null) {
  return value === null ? null : new Date(value).toISOString();
}

/** Prints what the model returned so a failed expectation is easy to diagnose. */
function show(label: string, value: unknown) {
  console.log(`\n${label}\n${JSON.stringify(value, null, 2)}`);
}

beforeAll(() => {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is not set. Add it to ride-share-app/.env.local before running npm run test:live.");
  }
});

describe("post import: pasted Facebook/Viber posts become ride drafts", () => {
  const parse = (text: string) => parseRidePost(text, {
    cities: parserCities,
    pickupPoints: parserPickupPoints,
    locationFallback: createOpenAILocationFallback(),
    now,
    timezone: "Europe/Skopje",
  });

  it("vozam Skopje Bitola, utre 17h imam mesto za trojca", async () => {
    const result = await parse("vozam Skopje Bitola, utre 17h imam mesto za trojca");
    show("import / offer", result);

    expect(result.classification).toBe("offer");
    expect(instant(result.draft.departureAt)).toBe(TOMORROW_17H);
    expect(result.draft).toMatchObject({
      origin: { cityId: CITY.skopje, pickupPointId: null },
      destination: { cityId: CITY.bitola, pickupPointId: null },
      seatsTotal: 3,
      pricePerSeatMkd: null,
      distanceKm: null,
    });
  });

  it("baram prevoz bitola ohrid utre od 11", async () => {
    const result = await parse("baram prevoz bitola ohrid utre od 11");
    show("import / request", result);

    // A passenger asking for a ride must never be imported as an offer.
    expect(result.classification).toBe("request");
    expect(result.draft).toMatchObject({
      origin: { cityId: CITY.bitola },
      destination: { cityId: CITY.ohrid },
      pricePerSeatMkd: null,
    });
  });

  it("reads a Cyrillic offer with a pickup point, price and time", async () => {
    const result = await parse("Возам Скопје - Охрид во петок во 8:30, тргнувам од Автокоманда. 2 слободни места, 500 ден по човек.");
    show("import / cyrillic offer", result);

    expect(result.classification).toBe("offer");
    expect(instant(result.draft.departureAt)).toBe("2026-09-25T06:30:00.000Z");
    expect(result.draft).toMatchObject({
      origin: { cityId: CITY.skopje, pickupPointId: 104 },
      destination: { cityId: CITY.ohrid },
      seatsTotal: 2,
      pricePerSeatMkd: 500,
    });
  });
});

describe("offer a ride: a driver's description fills the offer form", () => {
  const parse = (text: string) => parseOfferDescription({ text, mode: "create" }, {
    cities,
    pickupPoints,
    cars: [],
    carModels: [],
    now,
  });

  it("vozam Skopje Bitola, utre 17h imam mesto za trojca", async () => {
    const result = await parse("vozam Skopje Bitola, utre 17h imam mesto za trojca");
    show("offer / single trip", result);

    expect(result.trips).toHaveLength(1);
    expect(result.trips[0].draft).toMatchObject({
      source: "native",
      origin: { cityId: CITY.skopje },
      destination: { cityId: CITY.bitola },
      departureAt: TOMORROW_17H,
      seatsTotal: 3,
      pricePerSeatMkd: null,
      distanceKm: null,
    });
    expect(result.trips[0].draft.warnings.filter((warning) => warning.field === "departureAt")).toEqual([]);
  });

  it("splits an outbound and return trip and copies the shared seats and price", async () => {
    const result = await parse("Skopje - Ohrid petok 8:30, nazad nedela 18h. 2 mesta po 500 den");
    show("offer / return trip", result);

    expect(result.trips).toHaveLength(2);
    expect(result.trips[0].draft).toMatchObject({
      origin: { cityId: CITY.skopje },
      destination: { cityId: CITY.ohrid },
      departureAt: "2026-09-25T06:30:00.000Z",
      seatsTotal: 2,
      pricePerSeatMkd: 500,
    });
    expect(result.trips[1].draft).toMatchObject({
      origin: { cityId: CITY.ohrid },
      destination: { cityId: CITY.skopje },
      departureAt: "2026-09-27T16:00:00.000Z",
      seatsTotal: 2,
      pricePerSeatMkd: 500,
    });
  });
});

describe("ride search: a passenger's query becomes feed filters", () => {
  const parse = (query: string) => parseSearchQuery(query, {
    candidates: searchCandidates,
    now,
    timeZone: "Europe/Skopje",
    locationFallback: createOpenAILocationFallback(),
  });

  // Dates bound the calendar range (whole Skopje days); clock times are a separate window
  // that repeats on each day. Tuesday 2026-09-22 runs 2026-09-21T22:00Z to 2026-09-22T22:00Z.
  const TUESDAY = { dateFrom: "2026-09-22", departureAfter: "2026-09-21T22:00:00.000Z", departureBefore: "2026-09-22T22:00:00.000Z" };

  it("baram prevoz bitola ohrid utre od 11", async () => {
    const result = await parse("baram prevoz bitola ohrid utre od 11");
    show("search / route, date and time", result);

    expect(result).toMatchObject({
      originId: CITY.bitola,
      destinationId: CITY.ohrid,
      ...TUESDAY,
      timeAfter: "11:00",
      timeBefore: null,
      requestedSeats: null,
    });
  });

  // Working hours (rabotno vreme) are 09:00–17:00 Skopje time.
  it.each([
    ["baram prevoz skopje bitola utre nadvor od rabotno vreme", "17:00", "09:00"],
    ["Скопје Битола утре по работно време", "17:00", null],
    ["skopje bitola utre vo rabotno vreme", "09:00", "17:00"],
  ])("%s", async (query, timeAfter, timeBefore) => {
    const result = await parse(query);
    show(`search / working hours: ${query}`, result);

    expect(result).toMatchObject({ originId: CITY.skopje, destinationId: CITY.bitola, ...TUESDAY, timeAfter, timeBefore });
  });

  it("keeps working hours without a date as a daily window on every upcoming day", async () => {
    const result = await parse("skopje bitola nadvor od rabotno vreme");
    show("search / working hours, no date", result);

    expect(result).toMatchObject({
      originId: CITY.skopje,
      destinationId: CITY.bitola,
      departureAfter: null,
      departureBefore: null,
      timeAfter: "17:00",
      timeBefore: "09:00",
    });
  });

  it("treats a lone place as the destination and a bare day as the whole day", async () => {
    const result = await parse("Барам превоз до Охрид во петок");
    show("search / destination only", result);

    expect(result).toMatchObject({
      originId: null,
      destinationId: CITY.ohrid,
      departureAfter: "2026-09-24T22:00:00.000Z",
      departureBefore: "2026-09-25T22:00:00.000Z",
      timeAfter: null,
      timeBefore: null,
    });
  });
});
