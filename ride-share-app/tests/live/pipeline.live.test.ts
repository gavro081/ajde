import { readFile } from "node:fs/promises";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readScreenshot } from "@/lib/ai/read-screenshot";
import { checkRideDraft } from "@/lib/ai/check-ride-draft";
import { calculateFairPrice } from "@/lib/ai/fair-price-tool";
import { emptyOfferDraft } from "@/lib/rides/offer-interpretation";
import type { ParsedRidePost } from "@/lib/ai/parsed-ride-post";
import type { FairPriceArgs } from "@/lib/ai/ride-check-contract";
import { CITY, parserCities } from "./catalog";

vi.mock("server-only", () => ({}));
beforeAll(() => {
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY is required for this opt-in live check.");
});
afterEach(() => vi.restoreAllMocks());

/** Observe only model identifiers and elapsed time; never print inputs or transcripts. */
async function observeLive(label: string, work: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const models = new Set<string>();
  const started = Date.now();
  const startedAt = new Date().toISOString();
  let passed = false;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (...args) => {
    const response = await originalFetch(...args);
    try {
      const metadata: unknown = await response.clone().json();
      if (metadata && typeof metadata === "object" && "model" in metadata && typeof metadata.model === "string") models.add(metadata.model);
    } catch { /* An HTTP error or non-JSON reply has no observable model identifier. */ }
    return response;
  });
  try {
    await work();
    passed = true;
  } finally {
    console.log(JSON.stringify({ check: label, startedAt, outcome: passed ? "passed" : "failed", elapsedMs: Date.now() - started, requestedModel: label === "screenshot" ? process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini" : process.env.OPENAI_CHECK_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini", observedModels: [...models] }));
  }
}

describe("optional live AI import evidence", () => {
  it("reads at least one Bitola offer from the existing landing screenshot", async () => {
    await observeLive("screenshot", async () => {
      const bytes = await readFile(new URL("../../public/landing/post-bitola.png", import.meta.url));
      const result = await readScreenshot({ bytes, mimeType: "image/png" });
      // Boolean assertions cannot dump a screenshot transcript on failure.
      expect(result.posts.some(post => post.kind === "offer" && /bitola|битола/iu.test(post.text))).toBe(true);
      console.log(JSON.stringify({ check: "screenshot", postCount: result.posts.length, offerCount: result.posts.filter(post => post.kind === "offer").length }));
    });
  });

  it("requests fake price evidence with a real checker model and preserves an excessive driver price", async () => {
    await observeLive("price_checker", async () => {
      const parsed: ParsedRidePost = { classification: "offer", sourceLanguage: "mk", draft: {
        ...emptyOfferDraft(), source: "imported",
        origin: { cityId: CITY.skopje, pickupPointId: null, rawText: null },
        destination: { cityId: CITY.veles, pickupPointId: null, rawText: null },
        departureAt: "2026-09-23T15:00:00+02:00", seatsTotal: 3, distanceKm: null, pricePerSeatMkd: 1200,
      } };
      const fairPrice = vi.fn(async (args: FairPriceArgs) => calculateFairPrice(args, { petrol: 100, diesel: 95 }));
      const result = await checkRideDraft(parsed, {
        cities: parserCities,
        now: new Date("2026-09-22T10:00:00Z"),
        tools: { road_distance: async () => ({ distanceKm: 52 }), fair_price: fairPrice, find_similar_rides: async () => ({ rides: [] }) },
      });
      console.log(JSON.stringify({ check: "price_checker", callCount: result.trace.length, fairPriceExecutionCount: fairPrice.mock.calls.length, fairPriceAttempted: result.trace.some(entry => entry.tool === "fair_price"), fairPriceBasisRejected: result.trace.some(entry => entry.tool === "fair_price" && "error" in entry.result && entry.result.error.includes("do not match")), errorCount: result.trace.filter(entry => "error" in entry.result).length }));
      expect(result.status).toBe("checked");
      expect(fairPrice.mock.calls.length > 0).toBe(true);
      expect(result.trace.some(entry => entry.tool === "fair_price" && "pricePerSeatMkd" in entry.result && entry.result.pricePerSeatMkd === 121)).toBe(true);
      expect(result.parsed.draft.warnings.some(warning => warning.field === "pricePerSeatMkd" && warning.code === "needs_review" && warning.message.includes("1200 MKD") && warning.message.includes("121 MKD"))).toBe(true);
      expect(result.parsed.draft.pricePerSeatMkd).toBe(1200);
      console.log(JSON.stringify({ check: "price_checker", successfulCallCount: result.trace.filter(entry => !("error" in entry.result)).length, expectedEstimateMkd: 121, driverPricePreserved: true }));
    });
  });
});
