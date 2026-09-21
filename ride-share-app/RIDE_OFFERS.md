# Describing ride offers

On `/rides/new`, describe one or several explicit trips and select **Fill form**. English,
Macedonian Latin/Cyrillic, and `skp`/`bt` are supported. Results are editable; each tab requires
its own **Publish ride** action. Return journeys get separate tabs, with clearly shared vehicle,
seats and price applied to both. Recurring schedules need explicit trips instead.

Dates are displayed and submitted in Europe/Skopje even on a device in another timezone.
“Saturday 4pm” means the next future Saturday at 16:00, including today before that time.
Missing/ambiguous times need review. Offered seats and price are never guessed. A unique
matching saved car is used; otherwise the driver completes the vehicle variant. Fuel-price
suggestions still need the separate **Use suggestion** action.

**Correct this ride** changes only the active draft. Mentioned fields replace previous values;
omitted fields remain. Ambiguous mentioned replacements clear the affected value. **Undo fill**
restores that entire draft, including manual kilometres. **Create more drafts** appends trips.

After both cities are selected in the form, the browser POSTs exactly
`{originCity: "Skopje", destinationCity: "Bitola"}` to `/api/rides/distance`. The authenticated
server resolves these names to catalog city-centre coordinates, then requests OSRM driving
distance. Metres become kilometres; pickup selections do not change this city-to-city estimate.
Manual and imported forms follow the same sequence. A manual km override survives unrelated
edits until either city changes. Late requests cannot replace newer edits or Undo state.

The free public OSRM service is for this low-volume, non-commercial demo. A database-backed
permit limits the entire app to one provider request per 1.2 seconds. Requests have an eight-second
timeout. Changing routing provider belongs in the server distance operation; the form's two-name
contract remains unchanged. Failure leaves km optional and manually editable. The form links
OSRM, OpenStreetMap attribution, and map corrections.

All current tabs, field values, stable submission IDs and published links are saved to
`sessionStorage`, scoped by account and import context. Refresh/navigation recovery works in
the current browser session; there is no cross-device incomplete-draft storage. Storage errors
are shown honestly. Published tabs remain terminal. Publication atomically creates/reuses the
owned vehicle and ride; simultaneous retries use the same result, while distinct tabs create
distinct rides. No new import records are made by natural-language fill.

## Setup and verification

Apply these migrations before running the new publication/routing endpoints:

- `supabase/migrations/20260921210000_ride_routing_gate.sql`
- `supabase/migrations/20260921211000_atomic_ride_offers.sql`

Interpretation uses the existing server-only `OPENAI_API_KEY` and `OPENAI_MODEL`. Routing needs
no additional credentials. Existing student-account and onboarding restrictions apply to both APIs.

- `npm test`: full Vitest suite (393 tests passed on 21 September 2026).
- `npm run lint` and `npx tsc --noEmit`: lint/type verification.
- `npx next build --webpack`: production build.
- `npx tsx scripts/evaluate-offers.ts`: four live multilingual/return-trip examples, fixed clock;
  uses the configured AI service. All four passed on 21 September 2026.
- `psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/schema_smoke.sql`: includes
  rollback-only offer publication, ownership, idempotency, vehicle reuse and atomic failure checks.
- `node scripts/verify-offers.cjs --database-only`: simultaneous authenticated RPC requests and
  the shared routing gate. Creates a synthetic account and removes its records in `finally`.
- `node scripts/verify-offers.cjs`: additionally exercises a dev server at `OFFERS_BASE_URL`
  (default `http://localhost:3104`) with development sign-in enabled. Uses deterministic AI
  responses plus real database publication and real OSRM distance, a Los Angeles browser
  timezone, correction/Undo, refresh, keyboard tabs and mobile/desktop layouts. Requires the
  configured Supabase admin credential and an installed Playwright Chromium browser.

All listed checks passed on 21 September 2026. Both migrations were applied to the configured
development database and its types regenerated. Live city-to-city routing returned 174.3 km
for Skopje to Bitola; the test intentionally does not assert a permanent provider distance.
Browser verification also published an imported draft and manually completed a recovered native
draft during simulated routing failure. Synthetic verification records were removed afterward.
Review findings and their fixes are recorded in `../docs/verification/ride-offers.md`.

Regular tests mock external providers; live evaluations are explicit opt-in commands. The live
verification script must only target a development/test project. It never edits real users' records.
