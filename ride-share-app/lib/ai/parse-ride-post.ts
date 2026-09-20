import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { parsedRidePostSchema, type ParsedRidePost } from "./parsed-ride-post";
import type { ImportedRideDraft } from "../rides/ride-draft";

export type ParserCity = {
  id: number;
  nameMk: string;
  nameEn: string;
  aliases: string[];
};

export type ParserPickupPoint = {
  id: number;
  cityId: number;
  nameMk: string;
  nameEn: string;
  aliases: string[];
};

export type ParseRidePostContext = {
  cities: ParserCity[];
  pickupPoints: ParserPickupPoint[];
  now?: Date;
  timezone?: string;
};

export class RideParserError extends Error {
  constructor(
    message: string,
    readonly code: "missing_key" | "provider_error" | "refusal" | "invalid_output",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RideParserError";
  }
}

function openAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new RideParserError("OpenAI is not configured.", "missing_key");
  }
  return new OpenAI({ apiKey });
}

function parserPrompt(context: Required<Pick<ParseRidePostContext, "now" | "timezone">>) {
  return `You extract structured ride offers from informal student group posts.

The posts may mix Macedonian Cyrillic, Latin transliteration, Albanian, and English. Distinguish an
offered ride from somebody requesting a ride. Never turn a request into an offer. Use null for any
unknown value and add a concise warning for ambiguity. A whole-car price or negotiable price is not
a per-seat price, so return null for pricePerSeatMkd and warn. Relative dates must be interpreted
from ${context.now.toISOString()} in the ${context.timezone} timezone. Add a needs_review warning
when wording leaves the date or time uncertain. departureAt must be null unless the post provides
both a date (explicit or relative) and a time. Never use 00:00 as a placeholder for a missing time.
For threshold wording such as "after 6", use 18:00 as the earliest boundary and add an ambiguity
warning.

Only choose city and pickup IDs from the candidate list in the user message. Preserve the original
place wording in rawText. Set source to imported, importId and carId to null. Do not invent vehicle
details, distance, gender preference, tags, or exact times that are not present. Confidence and
fieldConfidence must reflect actual certainty, not optimism.`;
}

function candidatesPrompt(cities: ParserCity[], pickupPoints: ParserPickupPoint[]) {
  return JSON.stringify({
    cities: cities.map((city) => ({
      id: city.id,
      name_mk: city.nameMk,
      name_en: city.nameEn,
      aliases: city.aliases,
    })),
    pickup_points: pickupPoints.map((point) => ({
      id: point.id,
      city_id: point.cityId,
      name_mk: point.nameMk,
      name_en: point.nameEn,
      aliases: point.aliases,
    })),
  });
}

export function validateCanonicalLocations(
  parsed: ParsedRidePost,
  context: Pick<ParseRidePostContext, "cities" | "pickupPoints">,
): ParsedRidePost {
  const cityIds = new Set(context.cities.map((city) => city.id));
  const pickupById = new Map(context.pickupPoints.map((point) => [point.id, point]));
  const draft = structuredClone(parsed.draft);
  const warnings = [...draft.warnings];

  for (const [field, location] of [
    ["origin", draft.origin],
    ["destination", draft.destination],
  ] as const) {
    if (location.cityId !== null && !cityIds.has(location.cityId)) {
      location.cityId = null;
      location.pickupPointId = null;
      warnings.push({
        field,
        code: "needs_review",
        message: `The ${field} did not match a canonical city; choose it manually.`,
      });
      continue;
    }

    if (location.pickupPointId !== null) {
      const pickup = pickupById.get(location.pickupPointId);
      if (!pickup || pickup.cityId !== location.cityId) {
        location.pickupPointId = null;
        warnings.push({
          field,
          code: "needs_review",
          message: `The ${field} pickup did not belong to its city; choose it manually.`,
        });
      }
    }
  }

  draft.warnings = warnings;
  return parsedRidePostSchema.parse({ ...parsed, draft });
}

export function removeDepartureWithoutTime(
  text: string,
  parsed: ParsedRidePost,
): ParsedRidePost {
  const departure = parsed.draft.departureAt;
  const hasTime =
    /(?:^|\s)(?:во|vo|после|posle|after|at|ora|n[ëe])\s*(?:[01]?\d|2[0-3])(?::[0-5]\d)?\b/i.test(
      text,
    ) ||
    /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/.test(text) ||
    /\b(?:[01]?\d|2[0-3])\s*(?:h|ч|час(?:от)?)\b/i.test(text) ||
    /полноќ|polnok|midnight/i.test(text);

  if (!departure || hasTime) {
    return parsed;
  }

  const draft = structuredClone(parsed.draft);
  draft.departureAt = null;
  draft.warnings.push({
    field: "departureAt",
    code: "needs_review",
    message: "The post did not include a departure time; choose it manually.",
  });
  return parsedRidePostSchema.parse({ ...parsed, draft });
}

export async function parseRidePost(
  text: string,
  context: ParseRidePostContext,
): Promise<ParsedRidePost> {
  const now = context.now ?? new Date();
  const timezone = context.timezone ?? "Europe/Skopje";
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";

  try {
    const response = await openAIClient().responses.parse({
      model,
      input: [
        { role: "system", content: parserPrompt({ now, timezone }) },
        {
          role: "user",
          content: `Canonical candidates:\n${candidatesPrompt(context.cities, context.pickupPoints)}\n\nPost:\n${text}`,
        },
      ],
      reasoning: { effort: "none" },
      text: { format: zodTextFormat(parsedRidePostSchema, "parsed_ride_post") },
    });

    if (!response.output_parsed) {
      throw new RideParserError("The model did not return a structured result.", "refusal");
    }

    const parsed = parsedRidePostSchema.safeParse(response.output_parsed);
    if (!parsed.success) {
      throw new RideParserError("The model returned an invalid ride draft.", "invalid_output");
    }

    return removeDepartureWithoutTime(
      text,
      validateCanonicalLocations(parsed.data, context),
    );
  } catch (error) {
    if (error instanceof RideParserError) throw error;
    throw new RideParserError(
      "The parsing provider could not complete the request.",
      "provider_error",
      { cause: error },
    );
  }
}

const cityMatchers = [
  { id: 1, pattern: /скопје|skopje|shkup/i },
  { id: 2, pattern: /куманово|kumanovo/i },
  { id: 3, pattern: /битола|bitola/i },
  { id: 4, pattern: /прилеп|prilep/i },
  { id: 5, pattern: /тетово|tetovo|tetovë/i },
  { id: 6, pattern: /штип|shtip|\bstip\b/i },
  { id: 7, pattern: /велес|veles/i },
  { id: 8, pattern: /охрид|ohrid|ohër/i },
  { id: 9, pattern: /струмица|strumica/i },
  { id: 10, pattern: /гостивар|gostivar/i },
];

function mentionedCities(text: string) {
  return cityMatchers
    .map(({ id, pattern }) => ({ id, index: text.search(pattern) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index)
    .map(({ id }) => id);
}

/** Development/test stand-in only. It exercises the full UI contract without claiming AI quality. */
export function stubParseRidePost(text: string): ParsedRidePost {
  const normalized = text.trim();
  const lower = normalized.toLocaleLowerCase();
  const cities = mentionedCities(normalized);
  const isRequest = /\bbaram\b|барам|looking for|k[ëe]rkoj|ми треба/.test(lower);
  const isOffer = /\bimam\b|имам|нудam|нудам|slobodni|слободни|kam\s+\d+\s+vende/.test(lower);
  const seatsMatch = lower.match(/(\d+)\s*(?:слободни|slobodni|места|mesta|vende)/);
  const wordSeatCount = /(?:едно|едно\s+слободно)\s+место/.test(lower)
    ? 1
    : /(?:две|два)\s+(?:слободни\s+)?места/.test(lower)
      ? 2
      : null;
  const priceMatch = lower.match(/(\d{2,4})\s*(?:ден|den|mkd|денари)/);
  const negotiable = /договор|dogovor|marr[ëe]veshje/.test(lower);
  const wholeCarPrice = /цела\s+кола|cela\s+kola|whole\s+car/.test(lower);
  const hasCyrillic = /[\u0400-\u04ff]/.test(normalized);
  const hasAlbanian = /[ëç]|\b(?:kam|vende|nga|p[ëe]r)\b/i.test(normalized);
  const warnings: ImportedRideDraft["warnings"] = [];

  if (cities.length < 2) {
    warnings.push({
      field: cities.length === 0 ? null : "destination",
      code: "missing",
      message: "The stub could not identify both cities; confirm the route manually.",
    });
  }
  if (/утре|utre|петок|petok|premten|викенд/.test(lower)) {
    warnings.push({
      field: "departureAt",
      code: "needs_review",
      message: "Relative dates require the live parser; choose the exact departure time.",
    });
  }
  if (negotiable) {
    warnings.push({
      field: "pricePerSeatMkd",
      code: "needs_review",
      message: "The post says the price is negotiable; enter a per-seat amount.",
    });
  }
  if (wholeCarPrice) {
    warnings.push({
      field: "pricePerSeatMkd",
      code: "needs_review",
      message: "The post gives a whole-car price; enter the intended per-seat amount.",
    });
  }

  const draft: ImportedRideDraft = {
    source: "imported",
    importId: null,
    origin: {
      cityId: cities[0] ?? null,
      pickupPointId: /мавровка|mavrovka/i.test(normalized)
        ? 1
        : /автокоманда|avtokomanda/i.test(normalized)
          ? 4
          : null,
      rawText: null,
    },
    destination: { cityId: cities[1] ?? null, pickupPointId: null, rawText: null },
    departureAt: null,
    distanceKm: null,
    seatsTotal: seatsMatch ? Number(seatsMatch[1]) : wordSeatCount,
    carId: null,
    car: null,
    pricePerSeatMkd:
      negotiable || wholeCarPrice || !priceMatch ? null : Number(priceMatch[1]),
    notes: normalized,
    tags: [],
    genderPreference: null,
    confidence: 0.5,
    fieldConfidence: [],
    warnings,
  };

  return parsedRidePostSchema.parse({
    classification: isRequest ? "request" : isOffer ? "offer" : "unknown",
    sourceLanguage: hasAlbanian ? "sq" : hasCyrillic ? "mixed" : "unknown",
    draft,
  });
}
