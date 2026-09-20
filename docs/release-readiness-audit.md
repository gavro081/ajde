# Release-readiness audit

Audited from commit `0dd4631` before rewriting the project README. This document records the current
repository behavior; it is not a promise that unfinished Tuesday work already exists.

## Current README gap

There is no repository-root README. `ride-share-app/README.md` is still the unmodified
`create-next-app` template. Its development-server command is valid only after entering the app
directory and installing dependencies, but the rest of it does not describe this product. It omits
Supabase, migrations, authentication, OpenAI, fuel-price configuration, verification commands, and
known limitations.

## Runtime and working directory

- Run all application commands from `ride-share-app/`.
- Next.js 16.3.5 declares Node.js `>=20.9.0`.
- The repository does not currently pin Node or npm through `engines`, `.nvmrc`, `.node-version`, or
  an equivalent tool file.
- The audit machine used Node.js 23.7.0 and npm 11.2.0. These are observations, not project pins.
- `package-lock.json` uses lockfile version 3, so `npm ci` is the reproducible install command.

## Verified commands

| Purpose | Command | Audit result |
| --- | --- | --- |
| Install | `npm ci` | Correct command for the committed lockfile; clean-clone execution belongs to Phase 3 |
| Development | `npm run dev` | Existing local server responds on port 3000 |
| Unit tests | `npm test` | 31 tests passed |
| Lint | `npm run lint` | Passed |
| Type-check | `npx tsc --noEmit` | Passed; no package script exists yet |
| Production build | `npx next build --webpack` | Passed |
| Production server | `npm start` | Script exists; requires a completed build |
| Live parser evaluation | `npm run eval:parser` | Requires an OpenAI key and makes paid/networked model calls |
| Database smoke test | `psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/schema_smoke.sql` | Passed and rolled back |

The ordinary `npm run build` script invokes `next build`. The audit used the explicit webpack flag
because that is the already-verified production-build path for this repository; the final README
should choose and consistently document one build command.

## Environment contract

| Variable | Exposure | Current requirement |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-visible | Required for Supabase-backed pages and API routes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-visible public key | Required unless the legacy anon-key variable is used |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-visible public key | Supported legacy alternative; not listed as a separate assignment in `.env.example` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret | Present in the sample but not read by current application or scripts |
| `DATABASE_URL` | Server/CLI secret | Required for applying SQL and running the schema smoke test; not read at application runtime |
| `FUEL_PRICE_PETROL_MKD_L` | Server-only configuration | Optional for startup; required to display a petrol price/CO2 estimate in the demo |
| `FUEL_PRICE_DIESEL_MKD_L` | Server-only configuration | Optional for startup; required to display a diesel price/CO2 estimate in the demo |
| `OPENAI_API_KEY` | Server-only secret | Required for `/api/parse` and live parser evaluation |
| `OPENAI_MODEL` | Server-only configuration | Optional; defaults to `gpt-5.4-mini` |

Only `.env.example` is tracked. `.env.local` is ignored by `ride-share-app/.gitignore`. No real
values were copied or printed during this audit.

## Database setup order

There is no committed `supabase/config.toml`, Supabase CLI dependency, or migration npm script.
Against a new Supabase database, apply these SQL files once in filename order:

1. `20260920120000_initial_schema.sql`
2. `20260920121000_harden_internal_functions.sql`
3. `20260920122000_add_car_model_emissions_and_release_year.sql`
4. `20260920123000_seed_cities_and_skopje_pickup_points.sql`
5. `20260920124000_seed_common_car_models.sql`
6. `20260920125000_split_car_model_engine_size.sql`

From `ride-share-app/`, a PostgreSQL client can apply them with:

```sh
for migration in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration" || exit 1
done
```

The initial migration is not intended to be reapplied to an existing database. After migration,
run the rollback-safe smoke test shown in the command table. The final README should also offer the
Supabase SQL Editor as the manual alternative because the project has no local CLI configuration.

## Authentication and external configuration

Current observed behavior while signed out:

- `GET /api/health/supabase` returned HTTP 200 with `ok: true` and no user, confirming connectivity.
- `/rides/new` redirected to `/login?next=/rides/new`.
- `/rides/import` redirected to `/login?next=/rides/import`.
- `/api/parse` rejects an unauthenticated request before making a model call.

The current branch does not yet contain `/login`, an auth callback, onboarding, profile pages, a
profile-photo Storage bucket setup, or student-domain configuration. Those belong to Dimi's track
and must be reconciled after it lands. Supabase project creation, API/DB credentials, email provider
and redirect configuration, and Storage bucket/policy creation are dashboard operations rather than
steps automated by this repository.

## Known setup and security gaps to carry into the README

- Row-level security policies are intentionally absent; the initial migration says they are deferred.
- The service-role variable is described in `.env.example` but currently unused.
- No single command applies migrations, generates types, and runs the schema smoke test.
- No project runtime version is pinned even though Next.js requires Node.js 20.9 or newer.
- The protected ride routes cannot be exercised from a fresh signed-out clone until Dimi's auth flow
  is merged and the Supabase email provider is configured.
- Fuel-price values must be verified and supplied before presenting calculator estimates.
- The live parser evaluation uses a small curated fixture set and may incur OpenAI usage costs.
- The deterministic `resolveLocation` integration is still pending the other track.

## Phase 1 conclusion

The source of truth is now sufficiently audited to begin the README rewrite. Phase 2 must replace,
not lightly edit, the scaffold README and must preserve the distinctions above between required,
optional, external, implemented, and pending behavior.
