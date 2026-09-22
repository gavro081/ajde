# Setup guide

Full local setup for the app in `ride-share-app/`. The [README](../README.md) has the short version.

## Requirements

- Node.js 20.9 or newer
- npm with lockfile-v3 support
- A Supabase project
- PostgreSQL `psql` for the documented migration and smoke-test commands
- An OpenAI API key to use post import, AI search/explanations, or live evaluations

The repository does not yet pin a specific Node/npm version. The latest verified environment used
Node.js 23.7.0 and npm 11.2.0.

## 1. Install

```sh
git clone <repository-url>
cd lightweight-repo/ride-share-app
npm ci
```

All following commands assume the current directory is `ride-share-app/`.

## 2. Configure environment variables

```sh
cp .env.example .env.local
```

Fill in `.env.local` without committing it:

| Variable | Required for | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Application startup and Supabase pages | Browser-visible project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase access | Browser-visible public key; legacy projects may use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead |
| `DATABASE_URL` | Migrations and schema smoke test | Use the session-pooler PostgreSQL URL on port 5432 |
| `STUDENT_EMAIL_DOMAINS` | Student access policy | Server-only comma-separated exact domains |
| `OPENAI_API_KEY` | Post parsing, location fallback, natural-language search, match explanations, and live evaluations | Server-only; never prefix it with `NEXT_PUBLIC_` |
| `OPENAI_MODEL` | Optional ride-post parser override | Defaults to `gpt-5.4-mini` |
| `OPENAI_LOCATION_MODEL` | Optional location-fallback override | Defaults to `gpt-5-mini` |
| `OPENAI_SEARCH_MODEL` | Optional natural-language search override | Falls back to `OPENAI_MODEL`, then `gpt-5.4-mini` |
| `OPENAI_EXPLAIN_MODEL` | Optional match-explanation override | Falls back to `OPENAI_MODEL`, then `gpt-5.4-mini` |
| `OPENAI_CHAT_MODEL` | Optional chat-assistant override | Falls back to `OPENAI_MODEL` |
| `CHAT_AI_ENABLED` | Chat summary / Ask AI buttons | Optional; set `false` to turn the chat assistant off |
| `FUEL_PRICE_PETROL_MKD_L` | Petrol cost estimate | Optional at startup; verify the current MKD/L value before a demo |
| `FUEL_PRICE_DIESEL_MKD_L` | Diesel cost estimate | Optional at startup; verify the current MKD/L value before a demo |
| `DEV_AUTH_BYPASS` | Local sign-in without sending email | Optional; honored only when exactly `true` outside production |
| `SUPABASE_SECRET_KEY` | Local development bypass | Preferred server-only admin key when the bypass is enabled |
| `SUPABASE_SERVICE_ROLE_KEY` | Local development bypass | Legacy alternative to `SUPABASE_SECRET_KEY` |

`.env.local` is ignored by Git. Only the blank `.env.example` contract is tracked.

## 3. Create the database

There is no committed Supabase CLI project configuration yet. Against a new Supabase database,
load the local environment into the current shell, then apply the migration files once in filename
order:

```sh
set -a
. ./.env.local
set +a

for migration in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration" || exit 1
done
```

Alternatively, paste each file into the Supabase SQL Editor in the same order. The initial migration
creates the schema and is not intended to be reapplied to an existing database.

Verify the migrated schema and triggers with the rollback-safe smoke test:

```sh
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/schema_smoke.sql
```

## 4. Configure external services

In Supabase:

1. Copy the project URL and publishable/anon key into `.env.local`.
2. Copy the session-pooler database connection string into `DATABASE_URL`.
3. Enable email authentication for the magic-link flow.
4. Allow the local and deployed `/auth/callback` URLs in Supabase Auth redirect configuration.
5. Apply all migrations: the profile-photo bucket and its ownership policies are created by
   `20260920130000_add_profile_photo_storage.sql`.

The app checks `STUDENT_EMAIL_DOMAINS` before sending a link and again after callback/session
creation. Exact domain matching is used; suffix matches are not accepted.

## 5. Run

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To check Supabase wiring while signed out, open
`http://localhost:3000/api/health/supabase`; a response containing `"ok": true` and `"user": null`
is a successful anonymous connectivity check.

`/rides/new`, `/rides/import`, and `/api/parse` require a valid session. New users are sent through
`/onboarding` until their name, university, and profile photo are complete.

If hosted email is rate-limited during local development, set `DEV_AUTH_BYPASS=true` and configure
`SUPABASE_SECRET_KEY` (or the legacy service-role key). The separate bypass button appears only
outside production, still requires an allowed student-domain address, and creates an ordinary
cookie-backed Supabase session.

## Verification commands

Run from `ride-share-app/`:

```sh
npm test
npm run lint
npx tsc --noEmit
npx next build --webpack
```

The focused suite covers location resolution, ride-draft validation, form parsing, car selection,
price/CO2 calculations, feed filters, booking eligibility, search and explanation contracts,
sharing, comments, ride completion, impact queries, canonical parser guards, and fixture behavior.
Run only the 13 location-resolver tests with `npm run test:locations`.

The live parser evaluator makes real OpenAI requests:

```sh
npm run eval:parser
```

It fixes the evaluation timestamp for repeatable relative-date expectations and reports accuracy by
classification, route, departure, seats, and price. The latest recorded result is 5/5 in each field
on five curated fixtures; that is a regression signal, not a production-accuracy claim.

Natural-language search has a separate live evaluator:

```sh
npm run eval:search
```

Its fixtures cover English, Macedonian Cyrillic and transliteration, landmarks,
unknown places, missing fields, relative dates, and unsupported preference wording. See
[the recorded search evaluation](../ride-share-app/fixtures/search/README.md). Normal `npm test` runs
use mocked model responses and consume no OpenAI credits; both live evaluators do consume credits.

