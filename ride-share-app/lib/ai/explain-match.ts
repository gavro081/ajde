import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { matchExplanationResponseSchema } from "./explain-match-schema";
import type { SearchQueryResult } from "./search-query-schema";

export type ExplainRideFact = {
  rideId: string;
  originCityId: number;
  originName: string;
  destinationCityId: number;
  destinationName: string;
  departureAt: string;
  seatsAvailable: number;
  pricePerSeatMkd: number | null;
};

/** What the model sees: readable Skopje-local facts only, never IDs, UTC instants or field names. */
export type ExplainRidePrompt = {
  rideId: string;
  from: string;
  to: string;
  departs: string;
  seatsAvailable: number;
  pricePerSeatMkd: number | null;
};

export type ExplainSearchPrompt = {
  from: string | null;
  to: string | null;
  dates: string | null;
  dailyTime: string | null;
};

type ModelExplanation = { rideId: string; explanation: string };
export type ExplanationModelRunner = (input: {
  rides: readonly ExplainRidePrompt[];
  search: ExplainSearchPrompt;
}) => Promise<readonly ModelExplanation[]>;

const TIME_ZONE = "Europe/Skopje";

export async function explainMatch(
  rides: readonly ExplainRideFact[],
  context: SearchQueryResult,
  modelRunner: ExplanationModelRunner = runOpenAIExplanationModel,
) {
  if (rides.length === 0) return [];

  let proposed: readonly ModelExplanation[] = [];
  try {
    proposed = await modelRunner({ rides: rides.map(ridePrompt), search: searchPrompt(rides, context) });
  } catch {
    // Explanations are optional. Factual local templates keep the feed useful
    // when the provider is missing, slow, or unavailable.
  }

  const validRideIds = new Set(rides.map((ride) => ride.rideId));
  const counts = new Map<string, number>();
  for (const item of proposed) counts.set(item.rideId, (counts.get(item.rideId) ?? 0) + 1);
  const accepted = new Map<string, string>();

  for (const item of proposed) {
    if (!validRideIds.has(item.rideId) || counts.get(item.rideId) !== 1) continue;
    const ride = rides.find((candidate) => candidate.rideId === item.rideId);
    if (ride && explanationUsesSupportedFacts(item.explanation, ride, context)) {
      accepted.set(item.rideId, item.explanation.trim());
    }
  }

  return rides.map((ride) => ({
    rideId: ride.rideId,
    explanation: accepted.get(ride.rideId) ?? factualTemplate(ride, context),
  }));
}

function ridePrompt(ride: ExplainRideFact): ExplainRidePrompt {
  return {
    rideId: ride.rideId,
    from: ride.originName,
    to: ride.destinationName,
    departs: formatDeparture(ride.departureAt),
    seatsAvailable: ride.seatsAvailable,
    pricePerSeatMkd: ride.pricePerSeatMkd,
  };
}

function searchPrompt(rides: readonly ExplainRideFact[], context: SearchQueryResult): ExplainSearchPrompt {
  return {
    from: rides.find((ride) => ride.originCityId === context.originId)?.originName ?? null,
    to: rides.find((ride) => ride.destinationCityId === context.destinationId)?.destinationName ?? null,
    dates: describeDates(context),
    dailyTime: describeDailyTime(context),
  };
}

function describeDates(context: SearchQueryResult) {
  if (context.dateFrom) {
    const from = formatDate(`${context.dateFrom}T12:00:00Z`);
    return context.dateTo && context.dateTo !== context.dateFrom
      ? `${from} to ${formatDate(`${context.dateTo}T12:00:00Z`)}`
      : from;
  }
  // Interpretations saved before independent date/time filters only carry instant bounds.
  if (context.departureAfter && context.departureBefore) {
    return `${formatDeparture(context.departureAfter)} to ${formatDeparture(context.departureBefore)}`;
  }
  if (context.departureAfter) return `from ${formatDeparture(context.departureAfter)}`;
  if (context.departureBefore) return `before ${formatDeparture(context.departureBefore)}`;
  return null;
}

function describeDailyTime({ timeAfter, timeBefore }: SearchQueryResult) {
  if (timeAfter && timeBefore) {
    return `${timeAfter}–${timeBefore}${timeAfter > timeBefore ? " (overnight)" : ""}`;
  }
  if (timeAfter) return `at or after ${timeAfter}`;
  if (timeBefore) return `before ${timeBefore}`;
  return null;
}

const UNSUPPORTED_CLAIMS = /\b(?:safe|safer|trusted|trustworthy|verified driver|guaranteed|gender|woman|women|man|men|rating|recommended driver)\b/i;
// Every ride has already passed the feed filters, so a sentence that argues otherwise is wrong.
const CONTRADICTIONS = /\b(?:not|no longer|doesn['’]?t|isn['’]?t|however|but|although|outside|too early|too late|mismatch(?:es)?)\b/i;
// Internal identifiers and raw field names leak when the model echoes structured input.
const INTERNAL_DETAILS = /\(\s*\d+\s*\)|\b(?:ids?|originId|destinationId|departureAfter|departureBefore|timeAfter|timeBefore|dateFrom|dateTo|utc|gmt)\b|\d{4}-\d{2}-\d{2}T/i;

function explanationUsesSupportedFacts(text: string, ride: ExplainRideFact, context: SearchQueryResult) {
  const normalized = text.trim();
  if (
    normalized.length < 8 ||
    normalized.length > 180 ||
    UNSUPPORTED_CLAIMS.test(normalized) ||
    CONTRADICTIONS.test(normalized) ||
    INTERNAL_DETAILS.test(normalized)
  ) {
    return false;
  }

  // Any clock time mentioned must be the ride's Skopje departure or a requested window bound.
  const allowedTimes = new Set([formatClock(ride.departureAt), context.timeAfter, context.timeBefore].filter(Boolean));
  for (const [, hour, minute] of normalized.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)) {
    if (!allowedTimes.has(`${hour.padStart(2, "0")}:${minute}`)) return false;
  }

  const lower = normalized.toLocaleLowerCase("en-US");
  return [ride.originName, ride.destinationName]
    .map((value) => value.toLocaleLowerCase("en-US"))
    .some((value) => lower.includes(value));
}

function factualTemplate(ride: ExplainRideFact, context: SearchQueryResult) {
  const reasons: string[] = [];
  if (context.originId === ride.originCityId) reasons.push(`leaves from ${ride.originName}`);
  if (context.destinationId === ride.destinationCityId) reasons.push(`goes to ${ride.destinationName}`);
  if (context.requestedSeats !== null) {
    reasons.push(`${ride.seatsAvailable} seat${ride.seatsAvailable === 1 ? "" : "s"} available`);
  }
  if (describeDates(context) || describeDailyTime(context)) {
    reasons.push(`departs ${formatDeparture(ride.departureAt)}`);
  }
  if (reasons.length === 0) {
    reasons.push(`${ride.originName} to ${ride.destinationName}`, `departs ${formatDeparture(ride.departureAt)}`);
  }
  if (ride.pricePerSeatMkd !== null && reasons.length < 3) {
    reasons.push(`${ride.pricePerSeatMkd} MKD per seat`);
  }
  return `Matches because it ${reasons.join(", ")}.`;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
const clockFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatClock(value: string) {
  return clockFormatter.format(new Date(value));
}

/** e.g. "Sun 27 Sept at 17:00", in Skopje time. */
function formatDeparture(value: string) {
  return `${formatDate(value)} at ${formatClock(value)}`;
}

async function runOpenAIExplanationModel({ rides, search }: Parameters<ExplanationModelRunner>[0]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenAI is not configured.");
  const client = new OpenAI({ apiKey, timeout: 10_000 });
  const model = process.env.OPENAI_EXPLAIN_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";
  const response = await client.responses.parse({
    model,
    store: false,
    input: [
      {
        role: "system",
        content:
          "Every ride below has already been checked by the app and matches the passenger's search. " +
          "Write one short sentence per ride (under 150 characters) saying how it fits the search: " +
          "route, departure day and time, and, when useful, seats or price. All times are local " +
          "Skopje times; copy them exactly as given and never convert them. Never say or imply that " +
          "a ride does not match, is too early, or is too late. Never mention IDs, field names, or " +
          "time zones. Never claim safety, trustworthiness, driver quality, gender, ratings, " +
          "guarantees, or preferences. Return exactly one explanation per ride ID.",
      },
      { role: "user", content: JSON.stringify({ search, rides }) },
    ],
    reasoning: { effort: "none" },
    text: { format: zodTextFormat(matchExplanationResponseSchema, "ride_match_explanations") },
  });
  return response.output_parsed?.explanations ?? [];
}
