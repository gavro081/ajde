# Sunday track B — ride creation, pricing, and post import

This track owns manual ride creation and the imported-post parser. The manual flow and parser
contract should be finished before the OpenAI API key arrives; provider calls and tuning come last.

## Already done — do not repeat

- Next.js scaffold and dependencies
- Supabase browser/server clients, environment handling, and session-refresh proxy
- Database schema, triggers, seed cities/pickup points/car models, generated TypeScript types
- `supabase/DATABASE_MODELS.md`

Read `ride-share-app/AGENTS.md` and `ride-share-app/supabase/DATABASE_MODELS.md` before coding.
Do not change the database schema unless a genuine blocker is found. A schema change also requires
the documentation, generated types, and schema smoke test to be updated.

## Phase 1 — no OpenAI key required

Work through this entire phase while the key is unavailable.

### 1. Shared ride-draft contract and validation (~25 min)

- [x] Define one schema/type for a create-ride draft and use it for both manual entry and later AI
      output. Include canonical city/pickup IDs, departure time, seats, car details, price, notes,
      tags, confidence/warnings for imported fields, and the source/import reference.
- [x] Separate partial imported drafts from the stricter final form: AI output may be incomplete,
      but a published ride may not be.
- [x] Keep validation server-side as well as in the form.
- [x] Add focused tests for required fields, origin != destination, future departure, seats 1–8,
      and nonnegative price.

This contract is the boundary between `parseRidePost` and `/rides/new`; avoid a second parser-only
shape that forces ad-hoc mapping later.

### 2. Manual create-ride flow (~40 min)

- [ ] Build `/rides/new` with origin/destination city, pickup points filtered by city, date/time,
      seats, car, price, notes, tags, and gender preference.
- [ ] Persist a valid native ride with the signed-in user as `driver_id`.
- [ ] Make draft versus publish behavior explicit; do not silently publish an incomplete ride.
- [ ] Handle database validation errors and duplicate submissions cleanly.
- [ ] Support a prefilled imported draft through the shared draft contract. Until parsing is live,
      test this using a hard-coded fixture in development/test code only.

Acceptance check: a signed-in user can manually create a valid ride and invalid route, capacity,
date, or price values are blocked before/at persistence.

### 3. Car picker and editable consumption (~30 min)

- [ ] Query the seeded `car_models` catalog with make/model search.
- [ ] Selecting a model prefills fuel type and `consumption_l_100km`.
- [ ] Allow the driver to override consumption and save a `cars` snapshot without mutating the
      catalog row.
- [ ] Allow a manual car entry if the exact model is absent.

Acceptance check: selecting a catalog car prefills the form, an override survives save, and the
catalog data remains unchanged.

### 4. Price and CO2 calculator (~20 min)

- [ ] Put pure calculator functions in a reusable non-UI module and add unit tests.
- [ ] Suggested seat price: `distance_km * consumption_l_100km / 100 * fuel_price_mkd_l / seats`.
- [ ] Fuel CO2: petrol `2.31 kg/L`, diesel `2.68 kg/L`; label other fuel types honestly instead of
      inventing a factor.
- [ ] Read fuel prices from server environment/config, with assumptions visible beside the result.
- [ ] Do not fetch a live fuel price in this task; the plan says to verify it before recording.

Acceptance check: calculator tests cover petrol, diesel, rounding, invalid/zero inputs, and a user
override of the suggested price.

### 5. Parser shell, import UI, and fixtures (~45–60 min)

- [ ] Own `lib/ai/parse-ride-post.ts`, `app/api/parse/**`, and `/rides/import`.
- [ ] Define the structured-output schema using the shared ride-draft contract. Include an explicit
      offer-versus-request classification, nullable unknown fields, per-field warnings, and overall
      confidence.
- [ ] Build `/rides/import`: paste raw text, show parsing/loading/error states, review the result,
      then continue into the prefilled `/rides/new` form. Never auto-publish model output.
- [ ] Create `fixtures/posts/` with representative, anonymized Macedonian/Latin-mixed and Albanian
      samples. Include landmarks, implicit dates, offer/request wording, and price-per-person,
      price-per-car, and `договор` cases.
- [ ] Make fixtures/tests runnable with a stubbed parser before the provider is connected.

Acceptance check: the entire import-review-prefill UI works with a deterministic stub, while
production code clearly reports that parsing is unavailable rather than pretending it succeeded.

## Phase 2 — start when the OpenAI key arrives

### 6. `parseRidePost` with structured output (~40 min)

- [ ] Add the server-only OpenAI client and implement the schema-constrained call.
- [ ] Keep all provider code out of client components and never log the API key or raw secrets.
- [ ] Resolve parsed city/landmark text through track A's `resolveLocation` rather than trusting IDs
      produced by the model.
- [ ] Interpret relative dates using an explicit current timestamp and the `Europe/Skopje` timezone;
      preserve uncertainty as a warning for user review.
- [ ] Store the raw text and structured result in `imports`, then prefill `/rides/new`; the user must
      confirm/edit before saving a ride.
- [ ] Return useful errors for missing key, provider failure, schema refusal, and low confidence.

Acceptance check: pasting a real offer produces schema-valid JSON with canonical route IDs and a
reviewable form; a request-looking-for-a-ride is classified and is not silently published as an
offer.

### 7. Parser tuning round 1 (~2 h)

- [ ] Run every fixture and record expected versus actual structured fields.
- [ ] Tune prompt/schema/examples based on observed failures, not one-off string hacks.
- [ ] Verify mixed Cyrillic/Latin, landmarks, implicit dates, offer vs request, all price modes, and
      Albanian input.
- [ ] Add every discovered regression to the fixture suite before fixing it.
- [ ] Report a small accuracy table by field (route, time, seats, price, classification), plus known
      failures; do not hide uncertain output.
- [ ] Run lint, type-check/build, and relevant tests; commit this track separately.

## File ownership / collision avoidance

Track B owns:

- `app/rides/new/**`
- `app/rides/import/**`
- `app/api/parse/**`
- ride-draft validation/types and price/CO2 calculator modules
- car picker/create-ride components and actions
- `lib/ai/parse-ride-post.ts`, parser tests, and `fixtures/posts/**`

Track B should not edit login, onboarding, profile pages, or `lib/ai/resolve-location.ts`; those
belong to track A. Consume the resolver through its exported contract after track A's deterministic
checkpoint lands.

## Suggested merge checkpoints

1. Manual create form + car picker + calculator (fully usable without OpenAI).
2. Shared parser contract + fixtures + stubbed import-review UI.
3. Live structured parser + tuning changes after the key arrives.
