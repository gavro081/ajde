import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { parseOfferDescription } from "../lib/ai/parse-offer-description";

loadEnvConfig(process.cwd());
const catalog = {
  cities: [{ id: 1, name_en: "Skopje", name_mk: "Скопје", aliases: [] }, { id: 3, name_en: "Bitola", name_mk: "Битола", aliases: [] }],
  pickupPoints: [], carModels: [], cars: [], now: new Date("2026-09-21T10:00:00Z"),
};
const examples = [
  "going skp to bt 4pm saturday with a clio",
  "Одам Скопје до Битола во сабота во 16:00 со Клио",
  "Odam skp do bt sabota vo 16:00 so Clio",
  "Skopje to Bitola Saturday 4pm, back Sunday 6pm, Clio, 3 seats, 400 den",
];
async function main() {
  for (const text of examples) {
    const result = await parseOfferDescription({ text, mode: "create" }, catalog);
    const first = result.trips[0].draft;
    if (first.departureAt !== "2026-09-26T14:00:00.000Z") console.log(JSON.stringify(result));
    assert.equal(first.origin.cityId, 1);
    assert.equal(first.destination.cityId, 3);
    assert.equal(first.departureAt, "2026-09-26T14:00:00.000Z");
    assert.equal(first.distanceKm, null);
    if (text.includes("back")) {
      assert.equal(result.trips.length, 2);
      assert.equal(result.trips[1].draft.origin.cityId, 3);
      assert.equal(result.trips[1].draft.destination.cityId, 1);
      assert.equal(result.trips[1].draft.departureAt, "2026-09-27T16:00:00.000Z");
      for (const trip of result.trips) { assert.equal(trip.draft.seatsTotal, 3); assert.equal(trip.draft.pricePerSeatMkd, 400); }
    } else { assert.equal(first.seatsTotal, null); assert.equal(first.pricePerSeatMkd, null); }
    console.log(`PASS ${text}`);
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Evaluation failed"); process.exitCode = 1; });
