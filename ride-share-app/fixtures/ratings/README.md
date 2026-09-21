# Post-ride rating verification

Apply all migrations in order. The shared room/rating checkpoint is followed by
`20260921190000_rating_input_grants.sql`, which narrows client rating inputs. The application
uses the caller's Supabase session; public profiles call only `profile_rating_summary`.

From `ride-share-app`, run `npm test`, `npm run lint`, `npx tsc --noEmit`, and
`npx next build --webpack`. Run `supabase/tests/schema_smoke.sql` using psql with
`ON_ERROR_STOP=1`; it includes both rating and chat policy cases under JWT identities,
and rolls back its fixtures. Use a migrated database. The ratings cases cover raw-row privacy,
eligible counterparts, invalid legacy aggregates, multiple seats, duplicates, and denied mutations.

For real browser verification, start the production build with `npx next start --port 3103`.
In another terminal:

```powershell
$env:RATINGS_LIVE_TESTS = '1'
$env:RATINGS_TEST_BASE_URL = 'http://localhost:3103'
node fixtures/ratings/verify-live.cjs
```

This opt-in test creates five synthetic students, a car, three rides, bookings, and ratings in
the configured Supabase project. Admin-generated links establish ordinary user sessions without
sending email. The script deletes only its tracked fixtures in `finally`; cleanup failures fail
the command. Do not interrupt cleanup. It requires the URL/public key/admin key/student domains
from `.env` and Microsoft Edge, or an installed channel in `RATINGS_TEST_BROWSER`.

The script checks completion unlocking, both rating directions, mobile/tablet/desktop widths
(375px, 768px, 1280px), keyboard
radio selection/submission, escaped notes, reload, stale and concurrent duplicates, forged form
targets/ride IDs, aggregate-only profiles, empty profiles, direct RLS denial, and unchanged
bookings/seats/impact. Screenshots and results go to ignored `.test-dist/ratings/`.

For chat, booking request/decision/cancellation, Q&A, contacts, and trip-sharing regression,
also run the existing [chat browser fixture](../chat/README.md) against the same build.
These are automated browser checks, not a claim of human manual testing.

## Verified on 2026-09-21

- Full mocked suite: 349 tests across 24 files passed, including 119 rating tests.
- TypeScript, ESLint, and the Webpack production build passed.
- Shared message/rating SQL policies passed under hosted JWT roles; the rating input follow-up
  migration was reviewed and applied to the configured Supabase project.
- Rating browser checks passed both directions, forged inputs, concurrent duplicates, private
  feedback, aggregates, mobile layout, keyboard use, and lifecycle/impact preservation.
- The combined chat browser fixture passed actual three-member WebSocket delivery, membership
  history/revocation, offline recovery, Q&A, contacts, sharing, and booking lifecycle checks.
  Its booking check now waits for request confirmation before opening the passenger dashboard.
- Temporary browser accounts, cars, rides, bookings, messages, shares, and ratings were cleaned up.
- Independent Standards and Spec reviews reported no actionable findings. The review baseline
  was `a6ffbfc`; shared database work was reconciled with Dimi's deployed checkpoint.

The refreshed UI merge was also checked at all three viewport widths. Completed driver rides
open the passenger feedback section automatically; passenger rating forms remain visible outside
Booking options. Rating forms, submitted feedback, and public averages use the shared coral theme.
