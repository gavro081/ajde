import { loadEnvConfig } from "@next/env";

import fixtures from "../fixtures/posts/posts.json";
import {
  parseRidePost,
  type ParserCity,
  type ParserPickupPoint,
} from "../lib/ai/parse-ride-post";

loadEnvConfig(process.cwd());

const cities: ParserCity[] = [
  { id: 1, nameMk: "Скопје", nameEn: "Skopje", aliases: ["skopje", "shkup"] },
  { id: 2, nameMk: "Куманово", nameEn: "Kumanovo", aliases: ["kumanovo"] },
  { id: 3, nameMk: "Битола", nameEn: "Bitola", aliases: ["bitola", "monastir"] },
  { id: 4, nameMk: "Прилеп", nameEn: "Prilep", aliases: ["prilep"] },
  { id: 5, nameMk: "Тетово", nameEn: "Tetovo", aliases: ["tetovë", "tetova"] },
  { id: 6, nameMk: "Штип", nameEn: "Shtip", aliases: ["stip", "štip"] },
  { id: 7, nameMk: "Велес", nameEn: "Veles", aliases: ["veles"] },
  { id: 8, nameMk: "Охрид", nameEn: "Ohrid", aliases: ["ohër", "oher"] },
  { id: 9, nameMk: "Струмица", nameEn: "Strumica", aliases: ["strumica"] },
  { id: 10, nameMk: "Гостивар", nameEn: "Gostivar", aliases: ["gostivar"] },
];

const pickupPoints: ParserPickupPoint[] = [
  {
    id: 1,
    cityId: 1,
    nameMk: "Мавровка",
    nameEn: "Mavrovka",
    aliases: ["mavrovka", "кај мавровка"],
  },
  {
    id: 4,
    cityId: 1,
    nameMk: "Автокоманда",
    nameEn: "Avtokomanda",
    aliases: ["avtokomanda", "на автокоманда"],
  },
];

async function main() {
  const fields = ["classification", "route", "departure", "seats", "price"] as const;
  const correct = Object.fromEntries(fields.map((field) => [field, 0])) as Record<
    (typeof fields)[number],
    number
  >;
  const rows: Array<Record<string, string | number>> = [];

  for (const fixture of fixtures) {
    const parsed = await parseRidePost(fixture.text, {
      cities,
      pickupPoints,
      now: new Date("2026-09-20T12:00:00+02:00"),
      timezone: "Europe/Skopje",
    });
    const departureMatches =
      parsed.draft.departureAt === fixture.expected.departure ||
      (parsed.draft.departureAt !== null &&
        fixture.expected.departure !== null &&
        new Date(parsed.draft.departureAt).getTime() ===
          new Date(fixture.expected.departure).getTime());
    const checks = {
      classification: parsed.classification === fixture.expected.classification,
      route:
        parsed.draft.origin.cityId === fixture.expected.originCityId &&
        parsed.draft.destination.cityId === fixture.expected.destinationCityId,
      departure: departureMatches,
      seats: parsed.draft.seatsTotal === fixture.expected.seats,
      price: parsed.draft.pricePerSeatMkd === fixture.expected.price,
    };

    for (const field of fields) if (checks[field]) correct[field] += 1;
    rows.push({
      fixture: fixture.name,
      classification: checks.classification ? "✓" : `✗ ${parsed.classification}`,
      route: checks.route
        ? "✓"
        : `✗ ${parsed.draft.origin.cityId ?? "?"}→${parsed.draft.destination.cityId ?? "?"} (${parsed.draft.origin.rawText ?? "?"} | ${parsed.draft.destination.rawText ?? "?"})`,
      seats: checks.seats ? "✓" : `✗ ${parsed.draft.seatsTotal ?? "?"}`,
      price: checks.price ? "✓" : `✗ ${parsed.draft.pricePerSeatMkd ?? "?"}`,
      departure: checks.departure ? "✓" : `✗ ${parsed.draft.departureAt ?? "review"}`,
      warnings: parsed.draft.warnings.length,
      confidence: parsed.draft.confidence ?? 0,
    });
  }

  console.table(rows);
  console.table(
    fields.map((field) => ({
      field,
      correct: `${correct[field]}/${fixtures.length}`,
      accuracy: `${Math.round((correct[field] / fixtures.length) * 100)}%`,
    })),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown parser evaluation error";
  console.error(message);
  if (error instanceof Error && error.cause instanceof Error) {
    console.error(error.cause.message);
  }
  process.exitCode = 1;
});
