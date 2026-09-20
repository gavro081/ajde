# Track A implementation guide

This document explains how the tasks in [`20-09-dimi.md`](20-09-dimi.md) were implemented, where each solution lives, and how the pieces fit together. The work is still split across feature branches and has not been merged into `main`.

## Branch and commit map

The identity/profile branches are cumulative: each branch starts from the previous one. The location branches form a separate cumulative stack. The shared `ce58928` commit removes the network-dependent Google font so local and CI builds do not need to download a font during `next build`.

| Work unit | Branch | Commit |
| --- | --- | --- |
| Build reliability prerequisite | `feat/auth-access` and both stacks | `ce58928 fix(build): remove remote font dependency` |
| Authentication and access rules | `feat/auth-access` | `557cec6 feat(auth): add student magic-link access flow` |
| Onboarding and photo upload | `feat/profile-onboarding` | `5356f44 feat(profile): add secure onboarding and photo upload` |
| Public profile | `feat/public-profile` | `257ce7d feat(profile): add public student profile page` |
| Local email-limit workaround | `feat/dev-auth-bypass` | `c6b7dd7 feat(auth): add guarded development sign-in bypass` |
| Modern Supabase secret key support | `feat/dev-auth-bypass` | `2d30cf2 chore(auth): support Supabase secret API keys` |
| Deterministic location resolver | `feat/location-resolver` | `8818823 feat(location): add deterministic canonical resolver` |
| OpenAI model fallback | `feat/location-model-fallback` | `9eb9521 feat(location): add structured model fallback` |
| Location tuning and handoff | `feat/location-tuning` | `519578e feat(location): tune station aliases and document handoff` |

The intended merge order is:

1. `feat/auth-access`
2. `feat/profile-onboarding`
3. `feat/public-profile`
4. `feat/dev-auth-bypass` if the local-only bypass should be retained
5. `feat/location-resolver`
6. `feat/location-model-fallback`
7. `feat/location-tuning`

## 1. Authentication and access rules

Branch: `feat/auth-access`

### Solution files

| File | Responsibility |
| --- | --- |
| `ride-share-app/app/login/page.tsx` | Server-rendered login page, existing-session redirect, and status messages for invalid links, invalid domains, and sign-out. |
| `ride-share-app/app/login/login-form.tsx` | Client form with pending, success, and error states. |
| `ride-share-app/app/login/actions.ts` | Server action that validates the email, constructs the callback URL, and requests a Supabase magic link. |
| `ride-share-app/lib/auth/email-domain.ts` | Single server-only source of truth for permitted student domains. |
| `ride-share-app/app/auth/callback/route.ts` | Handles both PKCE authorization codes and hashed email OTP tokens, establishes the session, rechecks the domain, and redirects according to profile completeness. |
| `ride-share-app/lib/auth/session.ts` | Provides current-user lookup, profile-completeness checks, authenticated-page helpers, and safe internal redirect validation. |
| `ride-share-app/proxy.ts` | Refreshes Supabase cookies and protects `/onboarding`, `/rides`, and `/dashboard` routes on the server. |
| `ride-share-app/app/auth/signout/route.ts` | Signs the user out and redirects to the login status screen. |
| `ride-share-app/components/sign-out-button.tsx` | Reusable UI for the sign-out route. |
| `ride-share-app/.env.example` | Documents the comma-separated `STUDENT_EMAIL_DOMAINS` setting. |

### How it works

The login server action normalizes the submitted email and passes it to `isAllowedStudentEmail`. Domain checks live only in the server-only `lib/auth/email-domain.ts` module and use exact domain matches, avoiding insecure suffix checks. Allowed domains come from `STUDENT_EMAIL_DOMAINS`, with FINKI student domains as development defaults.

For an allowed address, Supabase `signInWithOtp` sends a one-time link whose redirect target is `/auth/callback`. The callback supports the URL shapes used by the installed Supabase SSR version: it exchanges a PKCE `code`, or verifies a `token_hash` and OTP `type`. After session creation, it verifies the email domain again. A user with `full_name`, `photo_url`, and `university` goes to the requested internal route; an incomplete user goes to `/onboarding`.

`safeNextPath` accepts only application-relative paths, preventing an attacker from using the login callback as an open redirect. The Next.js proxy uses `supabase.auth.getUser()` to verify the authenticated user, propagates refreshed cookies, rejects disallowed-domain sessions, and performs profile-completeness redirects before protected content renders.

The UI exposes clear states for a sent link, an invalid or expired link, a rejected domain, request failures, and completed sign-out.

## 2. Onboarding and profile-photo upload

Branch: `feat/profile-onboarding`

### Solution files

| File | Responsibility |
| --- | --- |
| `ride-share-app/app/onboarding/page.tsx` | Authenticated onboarding page and sign-out access. |
| `ride-share-app/app/onboarding/onboarding-form.tsx` | Form, local photo preview, browser-side photo validation, direct Storage upload, and final redirect. |
| `ride-share-app/app/onboarding/actions.ts` | Server-side field and ownership validation, public photo URL generation, and profile upsert. |
| `ride-share-app/supabase/migrations/20260920130000_add_profile_photo_storage.sql` | Creates/configures the `profile-photos` bucket and its Storage policies. |
| `ride-share-app/supabase/DATABASE_MODELS.md` | Documents the bucket, limits, visibility, and ownership convention. |
| `ride-share-app/supabase/tests/schema_smoke.sql` | Checks that the bucket and all four expected policies exist with the required configuration. |

### How it works

`/onboarding` calls `requireUser`, so anonymous visitors are redirected before the form renders. The required inputs are full name, university, and profile photo; bio and gender are optional.

The browser accepts only JPEG, PNG, or WebP images up to 5 MiB and creates a temporary object URL for the preview. It uploads the validated file directly to Supabase Storage at:

```text
<authenticated-user-uuid>/<random-uuid>.<extension>
```

The SQL migration makes `profile-photos` publicly readable because avatars appear on public profiles, while insert, update, and delete policies require the first path segment to equal `auth.uid()`. The client also uses `upsert: false`, so it cannot silently replace an existing object.

After upload, the server action validates all text bounds, the gender enum, and that the submitted Storage path begins with the authenticated user's UUID. It derives the public URL itself and upserts the `profiles` row with `id` equal to the authenticated user ID. If saving the profile fails, the client removes the just-uploaded object to avoid leaving an orphan. A successful save redirects to `/rides`.

The Storage migration must be applied to the active Supabase project before uploads can succeed. Creating only the bucket through the dashboard is insufficient because the ownership policies are also required.

## 3. Public profile page

Branch: `feat/public-profile`

### Solution files

| File | Responsibility |
| --- | --- |
| `ride-share-app/lib/profiles/public-profile.ts` | Server-only query and the deliberately limited public profile type. |
| `ride-share-app/app/profile/[id]/page.tsx` | Renders the avatar, real name, university, and optional bio/gender. |
| `ride-share-app/app/profile/[id]/loading.tsx` | Streaming loading skeleton. |
| `ride-share-app/app/profile/[id]/not-found.tsx` | Friendly missing-profile state. |
| `ride-share-app/app/profile/[id]/error.tsx` | Recoverable database/service error state with retry. |

### How it works

The server query uses an explicit projection containing only:

```text
id, full_name, photo_url, university, bio, gender
```

Phone, Instagram, Facebook, email, and other contact data are not selected, included in the returned TypeScript type, or passed to the page. This prevents accidental exposure in both the rendered UI and the Server Component payload. A missing database row calls Next.js `notFound()`, while database failures reach the route's error boundary.

## Development auth bypass added during testing

Branch: `feat/dev-auth-bypass`

This is a testing aid added after Supabase's hosted email quota was reached. It is not part of the original task list, but it allows the completed auth-dependent features to be exercised locally.

| File | Responsibility |
| --- | --- |
| `ride-share-app/app/login/actions.ts` | Implements the guarded bypass while retaining the normal magic-link flow and clearer rate-limit messages. |
| `ride-share-app/app/login/page.tsx` | Computes whether the bypass control may be shown. |
| `ride-share-app/app/login/login-form.tsx` | Shows the separate development sign-in button only when enabled. |
| `ride-share-app/lib/supabase/admin.ts` | Creates a server-only admin client from `SUPABASE_SECRET_KEY` or the legacy `SUPABASE_SERVICE_ROLE_KEY`. |
| `ride-share-app/.env.example` | Documents `DEV_AUTH_BYPASS` and both supported server-only key names. |

The bypass is available only when `DEV_AUTH_BYPASS=true` and `NODE_ENV` is not `production`. It still enforces the student-domain allowlist. The server-only admin client generates a magic-link token without sending email, then the ordinary SSR client verifies the hashed token so a normal user and cookie-backed session are created. The service/secret key is never sent to the browser. Production explicitly rejects this path even if the flag is accidentally configured.

## 4. Deterministic location resolver

Branch: `feat/location-resolver`

### Solution files

| File | Responsibility |
| --- | --- |
| `ride-share-app/lib/ai/resolve-location.ts` | Pure normalization/matching logic, stable result types, and typed model-fallback seam. |
| `ride-share-app/lib/ai/location-candidates.ts` | Loads canonical cities and pickup points from Supabase and maps database columns into resolver candidates. |
| `ride-share-app/lib/ai/resolve-location.test.ts` | Deterministic matching, normalization, unresolved, and fallback-seam tests. |
| `ride-share-app/tsconfig.location-tests.json` | Compiles the isolated TypeScript test target. |
| `ride-share-app/package.json` | Adds `npm run test:locations`. |
| `ride-share-app/.gitignore` | Ignores the generated `.test-dist` test output. |

### How it works

`normalizeLocation` lowercases text, transliterates Macedonian Cyrillic to Latin, removes Unicode diacritics and punctuation, collapses whitespace, and removes common leading context such as `кај`, `од`, and `на` after transliteration. This makes inputs such as `Штип`, `Stip`, and `ŠTIP` comparable without a network request.

`resolveLocation` first compares normalized `name_mk` and `name_en`, then the candidate's reusable aliases. Canonical-name matches return confidence `1`; alias matches return `0.98`. If there is no match and no fallback, it returns a stable unresolved object instead of guessing.

The exported `LocationResolution` contract is:

```ts
// Resolved
{ kind, id, displayName, confidence, resolution: 'alias' | 'model' }

// Unresolved
{ kind: null, id: null, displayName, confidence: 0, resolution: 'unresolved' }
```

The model seam is an optional `LocationModelFallback` function. Phase 1 defines and tests this seam but does not invent model output or make a network call.

`loadLocationCandidates` reads `cities` and `pickup_points` concurrently from Supabase and supplies `name_mk`, `name_en`, and `aliases` to the pure matcher. Tests can inject a small fixed vocabulary without needing Supabase.

## 5. OpenAI fallback for unresolved locations

Branch: `feat/location-model-fallback`

### Solution files

| File | Responsibility |
| --- | --- |
| `ride-share-app/lib/ai/openai-location-fallback.ts` | Server-only Responses API client, model selection, timeout, and safe failure behavior. |
| `ride-share-app/lib/ai/openai-location-contract.ts` | Strict structured-output request builder and defensive response parser. |
| `ride-share-app/lib/ai/location-candidates.ts` | Connects the fallback to `resolveCanonicalLocation` after deterministic matching. |
| `ride-share-app/lib/ai/resolve-location.ts` | Validates every model-selected ID and kind against the supplied canonical vocabulary. |
| `ride-share-app/lib/ai/resolve-location.test.ts` | Verifies zero model calls for aliases, vocabulary validation, structured requests, and malformed-response handling. |
| `ride-share-app/.env.example` | Documents server-only `OPENAI_API_KEY` and optional `OPENAI_LOCATION_MODEL`. |

### How it works

`resolveCanonicalLocation` loads the database vocabulary and supplies `createOpenAILocationFallback()` to the deterministic resolver. The fallback is `undefined` when there is no API key, so the feature degrades to deterministic-only behavior.

Known names and aliases return before the fallback is called. Only a genuine miss is sent to the OpenAI Responses API. The request contains the raw text and only the canonical candidate vocabulary. It sets `store: false` and requires strict JSON Schema output with `matched`, `kind`, `candidate_id`, and `confidence`.

The response parser rejects refusals, absent output text, malformed JSON, wrong types, and invalid confidence values. Even after parsing, `resolveLocation` accepts the answer only if both the ID and entity kind exist in the candidate array. A fabricated ID, mismatched kind, HTTP error, timeout, or thrown network error safely becomes `unresolved`.

`OPENAI_API_KEY` is read only inside a `server-only` module and is never named with the `NEXT_PUBLIC_` prefix. `OPENAI_LOCATION_MODEL` defaults to `gpt-5-mini`.

## 6. Location tuning and handoff

Branch: `feat/location-tuning`

### Solution files

| File | Responsibility |
| --- | --- |
| `ride-share-app/supabase/migrations/20260920131000_add_transport_center_aliases.sql` | Adds reusable variants for Skopje's Transport Centre. |
| `ride-share-app/lib/ai/resolve-location.test.ts` | Adds the tuned `кај главна станица` deterministic case and retains fallback safety coverage. |
| `ride-share-app/lib/ai/README.md` | Handoff contract, import guidance, return shapes, and verified examples for Track B. |
| `ride-share-app/supabase/DATABASE_MODELS.md` | Keeps the canonical location documentation synchronized with the migration. |
| `ride-share-app/supabase/tests/schema_smoke.sql` | Checks that the reusable Transport Centre aliases exist. |

### How it works

The tuning migration adds `главна станица`, `glavna stanica`, and `main station` to the existing `Транспортен центар` pickup point. These are reusable place names rather than entire fixture sentences. The migration uses a distinct alias set so rerunning it does not create duplicates.

Track B can call:

```ts
resolveCanonicalLocation(raw)
```

from `lib/ai/location-candidates.ts` in server-side parse/import code. The handoff also documents `resolveLocation(raw, candidates, fallback?)` for injected data and unit tests, plus the exact `LocationResolution` return type.

Verified deterministic examples are:

| Input | Canonical result |
| --- | --- |
| `Штип` | city: `Штип` |
| `Stip` | city: `Штип` |
| `кај Мавровка` | pickup point: `Мавровка` |
| `од Рамстор` | pickup point: `Рамстор Мол` |
| `на Автокоманда` | pickup point: `Автокоманда` |
| `кај главна станица` | pickup point: `Транспортен центар` |

The final location suite contains 13 deterministic/mocked tests. The tests never call OpenAI. A separate manual live check was also performed after the API key became available and returned a valid canonical Transport Centre choice.

The task requested running the resolver over real-post fixtures supplied by Track B. No Track B fixture file was present in this branch when the work was completed, so the implementation was tuned and handed off using the representative cases above. The resolver is ready to run against Track B's fixture set when that work is available.

## Verification performed

Each feature unit was built before its commit. Because the host environment could not start Turbopack workers, verification used the Webpack build path (`next build --webpack`) with the repository's bundled Node runtime. Lint also passed for each unit.

For the location stack, `npm run test:locations` passed all 13 tests on `feat/location-tuning`. These cover:

- the six documented deterministic inputs;
- casing, whitespace, Cyrillic/Latin, and diacritic normalization;
- unresolved behavior for unknown input;
- zero fallback calls for known aliases;
- rejection of model IDs outside the canonical vocabulary;
- strict Responses API request construction;
- parsing of a valid structured result; and
- safe handling of missing or malformed model responses.

The identity flows require the active Supabase project to have the Storage migration applied. They were manually exercised through the local development bypass; the public profile and Storage/database results should also be checked in the Supabase dashboard before merging.

## Configuration summary

No secret values are committed. The combined feature set uses these settings:

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe | Normal Supabase client access. |
| `STUDENT_EMAIL_DOMAINS` | Server-only usage | Exact comma-separated student domains. |
| `OPENAI_API_KEY` | Server only | Location fallback authentication. |
| `OPENAI_LOCATION_MODEL` | Server only | Optional location fallback model override. |
| `DEV_AUTH_BYPASS` | Server only | Enables the local bypass when exactly `true`; ignored in production. |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin capability used only by the local auth bypass. |

## Scope boundary

This track intentionally does not implement `/rides`, `/rides/new`, `/rides/import`, the ride-post parser, or booking/contact authorization. Those areas belong to Track B or later work. Therefore, reaching `/rides` after successful onboarding can currently produce a 404 on these branches; that does not indicate that the auth or onboarding redirect failed.
