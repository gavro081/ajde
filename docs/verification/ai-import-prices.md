# Fair-price checker increment

Ticket [#7](https://github.com/AI-Tech-Summit-Filip-Avramchev/lightweight-repo/issues/7) adds model-selected `fair_price` evidence to the pasted-offer checker. The existing `AI_IMPORT_PIPELINE_ENABLED` flag still gates the checker and review summaries; this slice adds no separate flag, database migration, or automatic publication.

## Calculation and evidence

The model chooses when to request the tool in [checkRideDraft](../../ride-share-app/lib/ai/check-ride-draft.ts). Its arguments are positive finite `distanceKm`, integer `availableSeats` from 1 to 8, nullable petrol/diesel `fuelType`, and nullable positive finite `consumptionL100Km`. The same four tool-capable rounds and six executed calls apply across routing and price requests.

[calculateFairPrice](../../ride-share-app/lib/ai/fair-price-tool.ts) calls the existing [calculateRideEstimate](../../ride-share-app/lib/rides/ride-estimate.ts); the [production factory](../../ride-share-app/lib/ai/ride-check-tools.ts) obtains prices from [fuelPriceConfig](../../ride-share-app/lib/rides/fuel-price-config.ts). This is deterministic arithmetic, not a model-generated price. Available passenger seats are the divisor, rather than car capacity or occupants including the driver. For the deterministic test fixture of 100 km, 7 L/100 km, 80 MKD/L, and three offered seats, the trip fuel cost is 560 MKD and the rounded per-seat share is 187 MKD. The fuel price is an explicit test fixture, not a claim about current pump prices.

Unknown consumption defaults to 7 L/100 km. Unknown fuel and unsupported hybrid/electric/LPG/other fuels use a clearly labelled petrol approximation; this is not an energy-cost model for those vehicles. For these defaults the model must submit null, rather than inventing known car details. Both default flags, configured fuel price, assumed fuel/consumption, distance, available-seat divisor, and zero toll allowance are returned in evidence. Missing or invalid configuration returns an error; one fuel's price never substitutes for another. Tolls are excluded because the checker has no toll evidence.

Before executing, the checker requires the draft's existing distance, or an earlier successful canonical-road result when distance is missing; actual offered seats and the draft's fuel/consumption must agree. It validates the result and recomputes the arithmetic from the returned assumptions. Inconsistent totals, rounded prices, basis, or default flags are rejected. Any result carrying an error property remains an error, including malformed error payloads. Zero-rounded estimates are unusable evidence.

Code compares the unchanged driver's per-seat price with the validated positive estimate. Only ratios **strictly above 2.5** or **strictly below 0.3** produce a `needs_review` warning with the actual numbers and assumptions, capped at 300 characters. Exact boundaries are quiet. A missing price produces no price warning. Model prose cannot create price claims through a price, null, or other finding field. Whole-check failure retains the original draft and prior warnings under the existing fail-open contract.

## Review and verification

[FairPriceSummary](../../ride-share-app/app/rides/import/fair-price-summary.tsx) shows the per-seat and whole-trip costs, offered seats, distance, configured MKD/L, fuel/consumption defaults, and toll exclusion under “How we checked this”. Missing configuration and other tool failures are labelled unavailable. The driver still explicitly continues into the existing editable form and controls publication.

Deterministic tests cover routing followed by price calculation, strict boundaries, actual offered-seat arithmetic, defaults and unsupported fuels, absent configuration, invalid or unrelated arguments, inconsistent and errored results, zero/overflow safety, shared budgets, metadata JSON round-tripping, preservation of the driver's price, production configuration wiring, and visible assumptions. They use no live provider or database requests. Integrated end-to-end and optional live evidence are recorded separately; this slice does not claim a live price-check run or production pricing accuracy.

Local verification before the feature commit: **681 tests passed in 53 files**, `npm run lint` passed, and `npx tsc --noEmit` passed after `next typegen`. This includes 43 new fair-price tests. No remote changes were made.
