import { loadEnvConfig } from "@next/env";

import fixtures from "../fixtures/search/queries.json";
import {
  parseSearchQuery,
  type SearchLocationCandidate,
} from "../lib/ai/parse-search-query";

loadEnvConfig(process.cwd());

const candidates: SearchLocationCandidate[] = [
  [1, "Скопје", "Skopje", ["skopje", "shkup"]],
  [2, "Куманово", "Kumanovo", ["kumanovo"]],
  [3, "Битола", "Bitola", ["bitola", "monastir"]],
  [4, "Прилеп", "Prilep", ["prilep"]],
  [5, "Тетово", "Tetovo", ["tetovo", "tetovë", "tetova"]],
  [6, "Штип", "Shtip", ["stip", "shtip", "štip"]],
  [7, "Велес", "Veles", ["veles"]],
  [8, "Охрид", "Ohrid", ["ohrid", "ohër", "oher"]],
  [9, "Струмица", "Strumica", ["strumica"]],
  [10, "Гостивар", "Gostivar", ["gostivar"]],
].map(([id, nameMk, nameEn, aliases]) => ({
  kind: "city" as const,
  id: id as number,
  cityId: null,
  nameMk: nameMk as string,
  nameEn: nameEn as string,
  aliases: aliases as string[],
}));

candidates.push({
  kind: "pickup_point",
  id: 11,
  cityId: 1,
  nameMk: "Мавровка",
  nameEn: "Mavrovka",
  aliases: ["мавровка", "mavrovka", "кај мавровка"],
});

async function main() {
  const rows = [];
  let passed = 0;

  for (const fixture of fixtures) {
    const result = await parseSearchQuery(fixture.text, {
      candidates,
      now: new Date("2026-09-21T10:00:00Z"),
      timeZone: "Europe/Skopje",
    });
    const checks = {
      origin: result.originId === fixture.expected.originId,
      destination: result.destinationId === fixture.expected.destinationId,
      seats: result.requestedSeats === fixture.expected.requestedSeats,
      departure: result.departureAfter === fixture.expected.departureAfter,
      departureBefore: !("departureBefore" in fixture.expected) || result.departureBefore === fixture.expected.departureBefore,
      timeAfter: !("timeAfter" in fixture.expected) || result.timeAfter === fixture.expected.timeAfter,
      timeBefore: !("timeBefore" in fixture.expected) || result.timeBefore === fixture.expected.timeBefore,
    };
    const success = Object.values(checks).every(Boolean);
    if (success) passed += 1;
    rows.push({
      fixture: fixture.name,
      result: success ? "✓" : "review",
      route: `${result.originId ?? "?"}→${result.destinationId ?? "?"}`,
      departure: result.departureAfter ?? "any",
      time: `${result.timeAfter ?? "any"}–${result.timeBefore ?? "any"}`,
      seats: result.requestedSeats ?? "?",
      warnings: result.warnings.length,
    });
  }

  console.table(rows);
  console.log(`Exact expected fields: ${passed}/${fixtures.length}`);
  if (passed !== fixtures.length) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown search evaluation error");
  process.exitCode = 1;
});
