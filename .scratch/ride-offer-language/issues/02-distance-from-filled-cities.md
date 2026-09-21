# 02: Calculate driving km from the two filled city names

**What to build:** After origin and destination city fields are filled in the shared offer form, the form sends those two city-name strings to the application's distance API and fills the returned road kilometres. The same behavior works for manual, imported and subsequently AI-filled routes, with manual override and a usable failure fallback.

**Blocked by:** None (can start immediately).

**Status:** completed

- [x] Trigger calculation from the current values in the form only after both city fields contain valid distinct catalog selections. Do not request routing for blank/unresolved fields or directly from a raw description or uncommitted model suggestion.
- [x] Send the origin city name and destination city name as two strings to an authenticated application distance operation. Validate and resolve these names against the existing catalog on the server. Reject unknown or same-city pairs; do not use a model or arbitrary-place geocoding.
- [x] Resolve the two canonical city names to their stored reference coordinates, then call public OSRM driving routing with those coordinates. OSRM does not accept city strings directly. Return a validated numeric distance in kilometres or a distinguishable failure; convert its metre result correctly.
- [x] Always calculate city-to-city distance. Pickup or drop-off choices do not alter the endpoints or cause recalculation. Keep route direction in request identity instead of assuming reverse trips have identical distance.
- [x] Apply the lookup in the shared form so manual city selection and prefilled imported/AI routes use the same city-fields-first sequence. A later city change starts a lookup for the newly filled pair; selecting an incomplete pair leaves distance unavailable.
- [x] Show the value as an estimated driving distance and let the driver edit it. Preserve a manual override through unrelated fields and pickup changes. Changing either city invalidates old-route km and the override before looking up the new route.
- [x] Associate responses with the requesting form/draft and city-pair revision. Delayed responses must not overwrite a later city choice or manual override, and must not populate a different form instance. Expose enough result/override state for the later Undo and recovery slices.
- [x] If routing times out, fails, returns no route or an invalid value, preserve all other form fields and allow manual km. Never retain old-route km as the new route's result and never substitute model guesses, synthetic seed data or straight-line distance. Distance remains optional for publishing.
- [x] Make provider calls server-side with an identifying User-Agent and explicit timeout. Respect OSRM's application-wide one-request-per-second usage limit, including concurrent clients and draft forms; per-tab delays alone are insufficient. Add required routing/OpenStreetMap attribution and fix-the-map link.
- [x] Use the selected public service only within its limited non-commercial demo conditions. Keep the provider replaceable, identify unavailable routing honestly, and preserve the manual fallback.
- [x] Keep the existing fuel-price and CO2 arithmetic. Distance changes update estimates but never automatically replace the driver's chosen seat price.
- [x] Test the public distance request/response contract plus the visible form flow: no premature call, exactly the two current city-name strings at the application boundary, catalog-to-coordinate translation, metre/km conversion, all entry paths, reverse routes, city/pickup edits, overrides, malformed results, timeout and stale responses.
- [x] Exercise concurrent routing requests against the combined rate limit. Perform a small live Skopje-to-Bitola smoke request and record the observed value/date without making a fixed kilometre value a permanent assertion. Regular tests mock the provider.
- [x] Verify manual publishing during provider failure and existing manual/import behavior. Run relevant tests and required repository checks and update distance/estimate documentation. This ticket can be demonstrated on the existing form without ticket 01.

## Completion evidence

Implemented and verified on 21 September 2026. See [combined verification](../../../docs/verification/ride-offers.md) for the 393-test suite, live AI and road-distance checks, actual database concurrency guarantees, browser flows, and resolved review findings. Changes are committed locally; nothing was pushed or pulled.
