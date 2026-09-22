# Share an accepted booking through an expiring public itinerary

## What to build

An accepted passenger can create, reuse, copy, and revoke a trip link from the passenger dashboard. A parent can open that link without signing in and see a limited itinerary. Deliver the controls, server checks, public page, and verification together, using the existing trip shares model.

## Acceptance criteria

- [ ] Only the authenticated passenger owning the accepted booking can create, reuse, or revoke its share. Each mutation rechecks ownership and current booking/ride state; forged, anonymous, and non-owner requests fail without changing data.
- [ ] Use the existing cryptographically random token default, never a booking-derived token. Resolve only the supplied token and never expose other users' tokens or a public enumeration endpoint.
- [ ] Set expiry to departure plus 24 hours, refuse creation when expiry has elapsed or the ride is cancelled, and reuse an active share where practical. Revocation deletes the selected owned record.
- [ ] Dashboard controls show pending, expired, success, clipboard-failure, and server-error states. A passenger can complete the create/copy/revoke flow on a narrow mobile screen.
- [ ] The public page works signed out and has loading and unavailable states. Every read checks token existence, expiry, booking acceptance, and ride cancellation, without caching that preserves access after invalidation.
- [ ] Invalid, expired, revoked, and no-longer-accepted shares are unavailable on subsequent reads, including after cancellation of a previously shared booking or ride. Live removal from an already open browser is not required.
- [ ] The public payload allowlists route/pickup, departure, driver name/photo, and car make/model/color. Phone/social contacts, passengers, applicants, private messages, and booking controls are absent from both payload and UI.
- [ ] Explain that the page is a shared itinerary rather than live tracking. Add no-index metadata and a no-referrer policy; do not introduce token analytics/logging or image requests that leak the token URL. Existing authenticated ride routes retain their access boundary.
- [ ] Add Vitest coverage through sharing actions/query interfaces for owner/non-owner/anonymous cases, booking states, cancellation, token invalidity/revocation, expiry boundaries, reuse, and the allowlisted projection. Fix the clock for time-sensitive cases and assert observable results and effects rather than internal query call order.
- [ ] Verify signed-out access, invalidation, clipboard handling, metadata/referrers, and mobile controls in a browser. Record any unavailable live verification honestly.
- [ ] Keep feature actions separate from existing booking actions, preserve auth/Supabase helper contracts, and avoid Dimi-owned discovery/search/view modules and shared visual changes. No new schema, dependencies, or credentials are expected; coordinate any unavoidable change with its owner.
- [ ] Preserve the documented absence of table RLS: application guards do not secure direct database access. Record expiry/privacy behavior for the final README update.
- [ ] Use a dedicated feature branch and Conventional Commits, run tests/lint/type checking and the documented Webpack production build before serial local integration, and do not push without explicit user approval. Read installed framework guides before framework changes.

## Blocked by

None (can start immediately).
