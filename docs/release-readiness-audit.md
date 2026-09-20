# Release-readiness audit

Initially audited from commit `0dd4631`, then reconciled after Track A landed. This document records
the integrated repository behavior; it is not a promise that unfinished Tuesday work already exists.

## README status

The initial audit found no repository-root README and only an unmodified `create-next-app` template.
That gap is resolved: the root README now documents the product, setup, architecture, authentication,
OpenAI, fuel-price configuration, verification commands, safety status, and known limitations.
`ride-share-app/README.md` points back to that single source of truth.

## Runtime and working directory

- Run all application commands from `ride-share-app/`.
- Next.js 16.3.5 declares Node.js `>=20.9.0`.
- The repository does not pin Node or npm through `engines`, `.nvmrc`, `.node-version`, or an
  equivalent tool file.
- The integration machine used Node.js 23.7.0 and npm 11.2.0. These are observations, not pins.
- `package-lock.json` uses lockfile version 3, so `npm ci` is the reproducible install command.

## Verified commands

| Purpose | Command | Integrated result |
| --- | --- | --- |
| Install | `npm ci` | Correct command for the committed lockfile; clean-clone execution remains Phase 3 |
| Development | `npm run dev` | Local server responds on port 3000 |
| Full unit suite | `npm test` | 48 tests passed |
| Location-only suite | `npm run test:locations` | 13 tests passed |
| Lint | `npm run lint` | Passed |
| Type-check | `npx tsc --noEmit` | Passed after Next route-type generation |
| Production build | `npx next build --webpack` | Passed with 12 generated routes |
| Live parser evaluation | `npm run eval:parser` | Requires an OpenAI key and makes paid/networked model calls |
| Database smoke test | `psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/schema_smoke.sql` | Passed and rolled back |

The default Next.js Turbopack build panicked in the restricted host while attempting to bind an
internal port. The Webpack build command above is the documented, verified path.

## Environment contract

| Variable | Exposure | Current requirement |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-visible | Required for Supabase-backed pages and APIs |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-visible public key | Required unless the legacy anon-key variable is used |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-visible public key | Supported legacy alternative |
| `DATABASE_URL` | Server/CLI secret | Required for applying SQL and the schema smoke test |
| `STUDENT_EMAIL_DOMAINS` | Server-only configuration | Exact domains accepted by magic-link and session guards |
| `OPENAI_API_KEY` | Server-only secret | Required for post parsing, location fallback, and live evaluation |
| `OPENAI_MODEL` | Server-only configuration | Optional ride-parser model; defaults to `gpt-5.4-mini` |
| `OPENAI_LOCATION_MODEL` | Server-only configuration | Optional location model; defaults to `gpt-5-mini` |
| `FUEL_PRICE_PETROL_MKD_L` | Server-only configuration | Optional at startup; required for petrol estimates |
| `FUEL_PRICE_DIESEL_MKD_L` | Server-only configuration | Optional at startup; required for diesel estimates |
| `DEV_AUTH_BYPASS` | Server-only configuration | Optional local-only email-limit workaround |
| `SUPABASE_SECRET_KEY` | Server-only secret | Preferred admin key for the guarded local bypass |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret | Legacy admin-key alternative for the guarded local bypass |

Only `.env.example` is tracked. `.env.local` is ignored. No real values were copied or printed
during either audit pass.

## Database setup order

There is no committed `supabase/config.toml`, Supabase CLI dependency, or migration npm script.
Against a new Supabase database, apply these SQL files once in filename order:

1. `20260920120000_initial_schema.sql`
2. `20260920121000_harden_internal_functions.sql`
3. `20260920122000_add_car_model_emissions_and_release_year.sql`
4. `20260920123000_seed_cities_and_skopje_pickup_points.sql`
5. `20260920124000_seed_common_car_models.sql`
6. `20260920125000_split_car_model_engine_size.sql`
7. `20260920130000_add_profile_photo_storage.sql`
8. `20260920131000_add_transport_center_aliases.sql`

From `ride-share-app/`, load `.env.local` into the shell and run:

```sh
for migration in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration" || exit 1
done
```

The initial migration is not intended to be reapplied. During integration the configured database
already contained the photo bucket/policies but was missing the final Transport Centre alias; the
idempotent alias migration was applied and the complete smoke test then passed.

## Authentication and external configuration

The integrated application contains `/login`, magic-link callback handling, sign-out, onboarding,
public profiles, exact student-domain checks, and server-side protection for ride/dashboard routes.
The profile-photo migration creates the public bucket plus authenticated owner-folder write policies.

Supabase project creation, API/DB credentials, enabling email auth, and allowing local/deployed
`/auth/callback` URLs remain dashboard operations. For hosted-email rate limits, the development
bypass is available only when explicitly enabled outside production with an admin key; it still
enforces the domain list and creates a normal cookie-backed session.

## Integrated location boundary

`parseRidePost` now passes the model-preserved raw origin/destination wording through the Track A
resolver. Canonical names and aliases resolve deterministically before the structured model fallback.
Pickup results derive their city from canonical database data. An unresolved place clears any
model-proposed IDs and adds a review warning rather than trusting the original output.

## Remaining setup and security gaps

- Row-level security policies for application tables remain deferred and block production use.
- No single command applies migrations, regenerates types, and runs the schema smoke test.
- No project runtime version is pinned even though Next.js requires Node.js 20.9 or newer.
- Hosted magic-link testing requires Supabase email and callback configuration.
- Fuel prices must be verified and supplied before presenting calculator estimates.
- Live parser evaluation uses a small curated fixture set and may incur OpenAI usage costs.
- Discovery, booking, contact-reveal, and trip-sharing flows remain unimplemented.

## Conclusion

The source of truth and root README now reflect the integrated identity, profile, location, ride,
calculator, and post-import work. Fresh-clone rehearsal remains a separate later phase and has not
been started by this integration update.
