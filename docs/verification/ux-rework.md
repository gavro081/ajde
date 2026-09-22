# UX rework and regression record

Reviewed against `PLAN.md` and the implementation at `5ada7a0`. Work remains on the existing
`ui-rework` branch. The pre-existing untracked root `AGENTS.md` is untouched.

## Functional baseline

The implementation, rather than the outdated README feature table, is the regression baseline.

| Area | Existing capabilities retained | UX changes |
| --- | --- | --- |
| `/` | Find/offer rides, sign in | Home-linked brand, session-aware navigation, calmer landing layout, clearly labelled example ride, import entry point |
| `/login`, auth callback/signout | Student-domain magic links, first-login account creation, guarded development bypass, safe return path, status messages, POST logout | Separate sign-in/signup entry states on the existing route, two-step explanation, accessible feedback |
| `/onboarding` | Required name, university and photo; optional bio/gender; file type/size restrictions; owned upload, profile save | Softer layout, photo preview, progress, field help, autofill, optional values already accepted by the server, completion feedback |
| `/rides` | Route/date/seat/gender filters, natural-language search, interpretation/corrections, explanations | Clearer filters, active navigation, pickup/drop-off landmarks in cards, practical empty-state links |
| `/rides/[id]` | Driver/car info, price, seat fullness, notes/tags, seat count and optional message, existing booking state, public Q&A | Explicit departure/destination stops, status/timezone, pending submit, success/error announcements, owner management link |
| `/rides/new` | Native/imported drafts, all ride fields, saved/catalog/manual car modes, editable estimates, six preference tags, draft/publish, duplicate prevention | Shared navigation, four form sections, selected car modes, validation summary/focus, saved-ride redirect with success feedback |
| `/rides/import` | Viber/Facebook/other source, post length checks, parser API, confidence/warnings/classification, manual review and editable prefill | City names instead of numeric IDs, readable times/prices, manual-entry fallback, shared navigation |
| `/dashboard/driver` | All offered rides, applicant details, accepted contact visibility, accept/decline, complete/cancel including full-ride acknowledgement | Clearer management hierarchy, applicant profile links, pending actions, quieter cancellation presentation, empty-state actions |
| `/dashboard/trips` | Booking/ride status, confirmed contacts, cancellation, expiring trip sharing/copy/revoke, personal/platform CO₂ estimates | Bookings before impact estimates, pending cancellation, no dead links to inaccessible closed rides, next-ride links |
| `/profile/[id]` | Existing public projection and privacy rules | Shared session-aware navigation, softer profile presentation |
| `/trip/[token]` | Anonymous limited itinerary, expiry/revocation checks, no-index/no-referrer privacy | Home link, clearer unavailable state, consistent surface styling |
| Loading/error/not-found | Existing recovery and route behavior | Loading skeleton, live status, home recovery, shared palette/focus styles |

There is no existing ride editing/deletion or draft-resume/publish UI. Those capabilities were
not invented as part of this presentation task. Booking cancellation and driver cancellation
remain distinct actions. Chat, ratings, reports and unclaimed imports in PLAN.md are not active
user flows in this implementation.

## Implementation boundaries

- No database migration, API request/response contract, auth policy, booking rule, calculation,
  parser/search logic, ownership check, or stored ride payload changed.
- Existing logout still submits POST to `/auth/signout`.
- Create-ride success uses the existing returned `rideId` and message to navigate to the owned
  ride detail. Draft and published statuses still come from the unchanged server action. React's
  automatic form reset is prevented so validation failures retain every entered field; the browser
  regression reproduces an invalid route, corrects it, and verifies the full saved payload.
- Existing profile fields and validators remain. The gender select now exposes all values already
  accepted by its server action, including leaving the optional value blank.
- Design tokens use the supplied five-color palette consistently: Evergreen (`#002400`) for
  primary actions and headings, Black Forest (`#273B09`) for hover and secondary emphasis, Olive
  Leaf (`#58641D`) for links and focus, Palm Leaf (`#7B904B`) for decorative/selected accents,
  and Lavender (`#DBD2E0`) for soft panels, dividers and status feedback. Shared brand,
  navigation, route stops and pending-submit components standardize repeated interactions.
- Keyboard focus, pointer/disabled cursors, 44px controls, mobile menu, active links, skip link,
  live feedback and reduced-motion support are applied across the app.

## Verification

Baseline and final suite: **182 automated tests passed in 16 files**. TypeScript, ESLint,
`npm run build -- --webpack`, and diff whitespace checks passed.

The standalone browser runner is `ride-share-app/scripts/verify-ux.cjs`. It uses Chromium and the
configured Supabase project, creates synthetic accounts and records, and removes only fixtures
owned by those newly created accounts, including uploaded photos. It does not send real emails.
Set `PLAYWRIGHT_MODULE_PATH` if Playwright is installed outside the app, optionally set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`, and point `UX_BASE_URL` at the running local dev server (default
`http://localhost:3102`). The server needs the existing non-production `DEV_AUTH_BYPASS` and an
admin key. Run from the repository root:

```sh
node ride-share-app/scripts/verify-ux.cjs
```

`UX_ONLY=true` runs the UX-specific checks without repeating the completed booking/sharing/Q&A
checks. Screenshots are generated in `.scratch/ux-*.png` (ignored, not committed).

Verified in Chromium against the configured Supabase project:

- Landing and signup entry, domain rejection, actual photo upload/profile save with all fields,
  sign-in, real magic-link callback with a generated test token and return destination, sign out,
  and all protected-page redirects. No email was sent.
- Authenticated mobile menu destinations, current page, profile, keyboard-operated mobile menu,
  skip link, visible focus, pointer cursors and 44px action targets.
- Browse, route/date filters, empty-state recovery, visible departure/destination/pickup landmarks,
  ride details, owner management, and live natural-language search with interpreted filters.
- Manual car creation, existing-car selection, catalog selection/consumption prefill, all ride
  fields, server validation recovery, saved data checks, published ride and private draft redirects.
- Live AI post import, human-readable review, and editable prefill. Simulated AI search failure
  preserves manual filtering.
- Booking request/accept/decline/cancel, contact reveal only after acceptance, and seat release.
- Driver cancellation/keep-ride confirmation, including mandatory acknowledgement for a full ride;
  completion, unchanged seat counts, and passenger CO₂ calculations.
- Three-user Q&A, safe text rendering, own-comment deletion and no other-author delete control.
- Share creation, clipboard content, anonymous itinerary projection, no-referrer avatar request,
  revocation and invalidation after booking cancellation.
- No horizontal overflow at **360, 390, 768, 1024 and 1440px** on landing, signup, onboarding,
  feed, profile, create ride, detail, import and both dashboards. Public itinerary and Q&A also
  exercised at 390px. Desktop and mobile screenshots were visually inspected.
- No browser exceptions or React console errors in the final UX run. Screenshot capture uses
  `caret: 'initial'` because Playwright's default caret hiding can otherwise mutate unhydrated
  inputs and produce a false hydration warning.

Each completed browser attempt removed its own synthetic users, rides, cars, imports and profile
photos. Existing seeded and user records were not modified. Earlier failures were sandbox network
restrictions, exact-label matching in the test runner, and the form-reset issue fixed above.

## Existing limitations outside this change

- Real email delivery is not exercised; the browser runner uses the existing local bypass.
- Fuel-price environment values are not configured, so live suggested-price application cannot
  be exercised. The existing arithmetic tests pass, and the form explains the unavailable estimate
  while preserving manual price entry.
- Table-level RLS and the previously deferred concurrent approval/completion database guard remain
  existing project limitations. This UI change does not claim to resolve them.
- Signup still sends new users to profile completion then the ride feed, as before; a new user's
  pre-signup deep link is not retained through onboarding.
- Drafts can be saved and viewed, but the baseline has no draft editor/publish-later action.
- Import datetime initialization still uses the baseline device-local conversion. The UI now makes
  local-entry versus Skopje-display time explicit; cross-timezone conversion behavior is unchanged.
