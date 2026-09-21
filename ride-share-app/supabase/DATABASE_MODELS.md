# Database models

This is the maintained human-readable reference for the application's PostgreSQL model. Read it
before changing database-backed features and update it in the same change as every schema migration.
The executable source of truth remains `supabase/migrations/`; generated application types live in
`lib/supabase/database.types.ts`.

## Conventions

- UUID identifiers are used for user-owned and transactional records. Small catalog tables use
  identity `bigint` identifiers.
- Timestamps are `timestamptz`. Tables with `updated_at` use the `set_updated_at` trigger.
- Optional foreign keys generally use `ON DELETE SET NULL`; owned child records generally use
  `ON DELETE CASCADE`; historical relationships that must remain valid use `ON DELETE RESTRICT`.
- `cars` stores a snapshot of make, model, fuel type, and consumption even when it references a
  catalog entry. This preserves the actual vehicle details and permits manual entries.
- `messages` and `ratings` have table-specific RLS. Other public tables still lack RLS;
  application checks are not a substitute for database protection. In particular, direct
  mutation of unprotected rides/bookings can undermine the membership facts these policies use.

## Storage

### `profile-photos`

Public bucket for profile avatars. Objects are limited to JPEG, PNG, or WebP files of at most 5 MB.
Authenticated users may insert, update, and delete objects only inside a top-level folder matching
their own Auth user UUID (`<auth.uid()>/<filename>`). Public reads are intentional because profile
photos are part of the public identity shown on ride and profile pages.

## Enums

| Enum | Values | Used by |
| --- | --- | --- |
| `profile_gender` | `woman`, `man`, `non_binary`, `prefer_not_to_say` | `profiles.gender` |
| `fuel_type` | `petrol`, `diesel`, `hybrid`, `electric`, `lpg`, `other` | `car_models`, `cars` |
| `ride_gender_preference` | `any`, `same_as_driver` | `rides.gender_preference` |
| `ride_status` | `draft`, `published`, `full`, `completed`, `cancelled` | `rides.status` |
| `ride_source` | `native`, `imported` | `rides.source` |
| `booking_status` | `requested`, `accepted`, `declined`, `cancelled` | `bookings.status` |

## Tables

### `profiles`

Application profile for one Supabase Auth user. `id` is both its primary key and a cascading foreign
key to `auth.users.id`. Required identity fields are `full_name`, `photo_url`, and `university`.
Optional contact/profile fields are `phone`, `instagram`, `facebook`, `bio`, and `gender`;
`verified_at` records verification. It also has `created_at` and trigger-maintained `updated_at`.
Names must be 2–100 trimmed characters, university names 2–160, and bios at most 500 characters.
The Tier 1 demo seed creates 25 clearly synthetic, verified student profiles with deterministic IDs.

### `cities`

Canonical city catalog used by routes. It stores unique Macedonian and English names, searchable
`aliases`, latitude, longitude, and `created_at`. Coordinates are constrained to valid geographic
ranges. Deleting a city cascades to its pickup points, but referenced ride cities prevent deletion.
The catalog is initially seeded with Skopje, Kumanovo, Bitola, Prilep, Tetovo, Shtip, Veles, Ohrid,
Strumica, and Gostivar.

### `pickup_points`

Canonical pickup/drop-off landmarks within a `city_id`, with Macedonian and English names,
`aliases`, coordinates, and `created_at`. Each localized name is unique within a city. The composite
key `(id, city_id)` lets rides enforce that a selected pickup point belongs to the selected city.
The initial seed contains Skopje landmarks only: Mavrovka, Skopje City Mall, Porta Vlae,
Avtokomanda, Ramstore Mall, Transport Centre, and East Gate Mall.
Transport Centre aliases also cover the reusable “главна станица” / “main station” phrasing
verified during location-resolver tuning.

### `car_models`

Seed/catalog data for vehicle lookup and environmental calculations:

| Column | Meaning |
| --- | --- |
| `id` | Identity primary key. |
| `make`, `model` | Vehicle manufacturer and model name. |
| `engine_size_l` | Required positive engine displacement in litres, stored separately from `model`. |
| `fuel_type` | Catalog fuel classification. |
| `consumption_l_100km` | Positive combined fuel consumption in litres per 100 km. |
| `co2_emissions_g_km` | Optional official combined tailpipe CO2 emissions in grams per kilometre; zero is valid for battery-electric vehicles. |
| `release_year` | Optional four-digit model release year, constrained to 1886–2100. |
| `created_at` | Catalog-record creation timestamp. |

`(make, model, fuel_type)` is unique. Null emissions or release year means that the source data does
not provide a reliable value; callers must not interpret null as zero.

The starter catalog is seeded and normalized by `20260920124000_seed_common_car_models.sql` and
`20260920125000_split_car_model_engine_size.sql`. It contains 50 common
low-to-mid-budget models, including every model family requested in `PLAN.md`. Values are rounded,
representative combined figures intended for ride-cost and emissions estimates, not regulatory or
vehicle-specific certification. The supplied `co2.csv` informed close matches; older European-market
generations use representative manufacturer-cycle figures. Engine displacement is stored in
`engine_size_l`; model names contain only the model/generation or recognized variant name.

### `cars`

A driver's actual vehicle. It belongs to `owner_id` (`profiles`, cascading delete) and can optionally
reference `car_model_id` (`car_models`, set null on catalog deletion). It snapshots required `make`,
`model`, `fuel_type`, and positive `consumption_l_100km`, plus optional `color` and three-character
alphanumeric `plate_last3`. `seats_total` is 1–8. It has `created_at` and trigger-maintained
`updated_at`.

### `imports`

Stores an imported social post before/after parsing: required nonblank `raw_text`, optional
`source_hint`, object-shaped `parsed_json`, optional 0–1 `confidence`, `spam_flags`, optional
`created_by` profile (set null on profile deletion), and `created_at`.

### `rides`

The central trip offer. A ride links optional `driver_id`, optional `car_id`, required origin and
destination cities, optional city-matched pickup points, `departure_at`, 1–8 `seats_total`, derived
`seats_available`, optional nonnegative `price_per_seat_mkd`, optional `notes`, object-shaped
`details`, `tags`, gender preference, status, source, optional `import_id`, optional `claimed_by`, and
timestamps. Origin and destination cities must differ.

A native ride requires a driver. An imported ride requires an import record. Driver deletion is
restricted; car and claimant deletion set their references null; import deletion is restricted.
Pickup-point composite foreign keys guarantee that each point belongs to its corresponding city.
The Tier 1 demo seed adds 50 deterministic, future published rides distributed across the city
catalog. Their `details.demo_seed` flag distinguishes them from user-created records.

### `bookings`

A passenger's request for seats on a ride. It contains `ride_id`, `passenger_id`, 1–8 `seats`, an
optional message, status, optional `decided_at`, and timestamps. Accepted and declined bookings must
have `decided_at`. A passenger can have only one active (`requested` or `accepted`) booking per ride.
Ride and passenger identity cannot be changed after insertion. Deleting the ride or passenger
cascades to the booking.

### `ride_comments`

Public Q&A on a ride. Each row links a ride and author profile, contains a trimmed 1–2000 character
`body`, and has creation and trigger-maintained update timestamps. Parent deletion cascades.

### `messages`

One message scoped to a ride. `recipient_id = null` means the shared ride room; non-null recipients
are deferred direct-message data and inaccessible through room policies. The body constraint is
1–4000 trimmed characters (chat's application limit is 2000). Sender and any recipient must differ.
Deleting the ride or a referenced participant cascades. No second room/membership table exists.

Only the driver and currently accepted passengers can read room messages. Passengers see rows
created at or after their accepted booking's `decided_at`; the driver sees the whole room history.
Cancelled bookings lose access immediately. Cancelled rides retain authorized read-only history.
Sends require the authenticated sender, a real driver, null recipient, a non-cancelled ride, and
`statement_timestamp() <= departure_at + interval '48 hours'` (inclusive, matching chat).
Updates/deletes are revoked. `messages_stamp` overwrites creation timestamps with the database
clock and clears read receipts on every insert, including privileged inserts.

`messages` is added idempotently to `supabase_realtime`. Postgres Changes applies SELECT RLS to
each recipient. Chat history must filter `ride_id` and `recipient_id IS NULL`, order by
`created_at DESC, id DESC`, and use both columns in the older-page cursor. The partial
`messages_room_cursor_idx` supports that exact query and replaces the original conversation index;
Realtime is a refresh signal, not authority. Previously delivered messages cannot be recalled.

### `ratings`

A post-ride rating from `rater_id` to a different `ratee_id`, scoped to `ride_id`. `score` is 1–5,
`note` is optional and at most 1000 characters, and `created_at` records submission. The tuple
`(ride_id, rater_id, ratee_id)` is unique. Related ride/profile deletion cascades.

INSERT RLS requires the authenticated rater and a completed ride: accepted passengers can rate
its driver, and that driver can rate accepted passengers. Self-rating, passenger-to-passenger,
unclaimed rides, and other booking/ride statuses are ineligible. Multiple seats do not multiply
ratings. The unique tuple is the final concurrent-submission guard. Notes submitted by clients
are optional, nonblank when present, trimmed (including surrounding tabs/newlines), and limited
to 1000 characters. Clients cannot supply rating IDs or creation timestamps. No updates/deletes.
Only rater and ratee can SELECT raw detail; anonymous users and unrelated students see no rows.

Public `profile_rating_summary(target_profile_id)` returns exactly `{ average, count }`, with
`average = null, count = 0` for no ratings. It excludes legacy rows that fail current eligibility
and uses EXISTS so multiple bookings/seats cannot multiply contributions. It exposes no identities,
ride IDs, or notes. This security-definer function has an empty search path and explicit execute
grants only to `anon` and `authenticated` (besides privileged database roles). The session-bound
boolean helpers `can_read_ride_room`, `can_send_ride_room`, and `can_rate_ride` similarly fix their
search paths and permit authenticated callers only. They never accept a caller-supplied rater.

Rating edits, appeals, moderation UI, and AI spam/safety screening are deferred. Notes are private
feedback, not a moderated reporting channel; render them as escaped text.

### `reports`

A moderation report by `reporter_id`, targeting a user, a ride, or both. It stores a required
trimmed 1–100 character `reason`, optional body up to 2000 characters, and `created_at`. At least one
target is required, and a reporter cannot target themself. Deleting a reporter cascades; deleting a
target user or ride preserves the report and nulls that target.

### `trip_shares`

A public, expiring share link for a booking. It contains `booking_id`, a unique random token,
`expires_at`, and `created_at`; expiry must be later than creation. Booking deletion cascades.

## Relationship map

```text
auth.users 1--1 profiles
profiles 1--* cars  *--0..1 car_models
cities   1--* pickup_points
profiles 1--* rides *--1 cities (origin and destination)
rides    *--0..1 cars
imports  1--* rides (imported rides)
rides    1--* bookings *--1 profiles (passenger)
rides    1--* ride_comments *--1 profiles (author)
rides    1--* messages *--1 profiles (sender and recipient)
rides    1--* ratings *--1 profiles (rater and ratee)
rides    1--* reports; profiles 1--* reports
bookings 1--* trip_shares
```

## Database behavior

- `set_updated_at()` refreshes `updated_at` on updates to `profiles`, `cars`, `rides`, `bookings`,
  and `ride_comments`.
- `guard_booking_identity()` prevents changing a booking's ride or passenger.
- `sync_ride_seats()` calls `recalculate_ride_seats()` after booking inserts, updates, and deletes.
  Accepted seats are subtracted from ride capacity; zero availability changes `published` to `full`,
  while restored availability changes `full` back to `published`. Overbooking raises a constraint
  error.
- `guard_ride_capacity_change()` rejects capacity below already accepted seats and recalculates
  availability when capacity changes.
- Internal trigger functions use `SECURITY DEFINER`, fixed empty search paths, and revoked public,
  anonymous, and authenticated execute permissions. Only `recalculate_ride_seats(uuid)` appears in
  generated API types, but direct client execution is revoked.

## Keeping this document current

For every database change:

1. Add a new migration; do not rewrite a migration that may already be applied.
2. Update this file's affected enum, table, relationship, and behavior sections.
3. Regenerate `lib/supabase/database.types.ts` from the migrated database.
4. Extend and run `supabase/tests/schema_smoke.sql` for new invariants.

## Shared policy helpers and verification

`can_read_ride_room(uuid, timestamptz)`, `can_send_ride_room(uuid)`, and
`can_rate_ride(uuid, uuid)` derive the viewer from `auth.uid()`, have fixed empty search paths,
and use SECURITY DEFINER to query membership without depending on caller table privileges. PUBLIC
and anon execution is revoked; authenticated execution is granted only for policy checks. The narrow
rating aggregate is also SECURITY DEFINER with explicit grants. No helper accepts a viewer identity.

`schema_smoke.sql` includes `communication_reputation.sql` and `room_policies.sql`, which switch into real PostgreSQL roles and set
JWT subject claims. It tests driver/two passengers/new passengers, denial states, forged data,
immutable rows, send expiry, cancellation, and aggregate privacy. Every fixture rolls back.

Types were regenerated from the migrated hosted PostgreSQL catalog using Supabase's
`@supabase/postgrest-typegen` through a rollback-only transaction. The ratings follow-up migration
restricts writable columns and private-note input without changing the room contract.

