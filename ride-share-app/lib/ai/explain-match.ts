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

type ModelExplanation = { rideId: string; explanation: string };
export type ExplanationModelRunner = (input: {
  rides: readonly ExplainRideFact[];
  context: SearchQueryResult;
}) => Promise<readonly ModelExplanation[]>;

export async function explainMatch(
  rides: readonly ExplainRideFact[],
  context: SearchQueryResult,
  modelRunner: ExplanationModelRunner = runOpenAIExplanationModel,
) {
  if (rides.length === 0) return [];

  let proposed: readonly ModelExplanation[] = [];
  try {
    proposed = await modelRunner({ rides, context });
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
    if (ride && explanationUsesSupportedFacts(item.explanation, ride)) {
      accepted.set(item.rideId, item.explanation.trim());
    }
  }

  return rides.map((ride) => ({
    rideId: ride.rideId,
    explanation: accepted.get(ride.rideId) ?? factualTemplate(ride, context),
  }));
}

const UNSUPPORTED_CLAIMS = /\b(?:safe|safer|trusted|trustworthy|verified driver|guaranteed|gender|woman|women|man|men|rating|recommended driver)\b/i;

function explanationUsesSupportedFacts(text: string, ride: ExplainRideFact) {
  const normalized = text.trim();
  if (normalized.length < 8 || normalized.length > 180 || UNSUPPORTED_CLAIMS.test(normalized)) {
    return false;
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
  if (context.departureAfter || context.departureBefore) {
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

function formatDeparture(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Skopje",
  }).format(new Date(value));
}

async function runOpenAIExplanationModel({ rides, context }: Parameters<ExplanationModelRunner>[0]) {
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
          "Explain briefly why each ride matches the supplied search criteria. Use only the supplied " +
          "route, departure, seats, and price facts. Never claim safety, trustworthiness, driver quality, " +
          "gender, ratings, guarantees, or preferences. Return exactly one explanation per ride ID.",
      },
      { role: "user", content: JSON.stringify({ search: context, rides }) },
    ],
    reasoning: { effort: "none" },
    text: { format: zodTextFormat(matchExplanationResponseSchema, "ride_match_explanations") },
  });
  return response.output_parsed?.explanations ?? [];
}
