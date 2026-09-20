import { z } from "zod";

import { importedRideDraftSchema, type ImportedRideDraft } from "../rides/ride-draft";

export const parsedRidePostSchema = z.object({
  classification: z.enum(["offer", "request", "unknown"]),
  sourceLanguage: z.enum(["mk", "sq", "mixed", "unknown"]),
  draft: importedRideDraftSchema,
});

export type ParsedRidePost = z.infer<typeof parsedRidePostSchema>;

export class ParserUnavailableError extends Error {
  constructor() {
    super("Ride-post parsing is not configured yet.");
    this.name = "ParserUnavailableError";
  }
}

export async function parseRidePost(text: string): Promise<ParsedRidePost> {
  void text;
  throw new ParserUnavailableError();
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
    seatsTotal: seatsMatch ? Number(seatsMatch[1]) : null,
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
