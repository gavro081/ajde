# Private ride rooms

Each `/rides/[id]/chat` page is one room shared by the driver and currently accepted passengers.
Ride detail and My trips provide entry points. Room participants can see each other’s phone numbers and optional social-profile links. Drivers also see phone numbers on incoming booking requests.

## Setup

Apply `supabase/migrations/20260921140000_communication_reputation_policies.sql` after earlier
migrations. It makes room recipients nullable, enables message/rating RLS, adds explicit grants,
and adds `public.messages` to `supabase_realtime`. Use the existing `.env` Supabase URL/public key
and normal student sessions; the app never uses an admin client for chat. Realtime must be enabled
for the Supabase project. Also apply `20260922090000_room_full_history.sql` and
`20260922091000_chat_ai_budget.sql` before using full history and AI. AI uses the server-only
`OPENAI_API_KEY` and `OPENAI_MODEL`; `OPENAI_CHAT_MODEL` is an optional override.

Validate the publication in the SQL editor:

```sql
select * from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'messages';
```

Run `supabase/tests/schema_smoke.sql` with psql and `ON_ERROR_STOP=1`. It includes
`room_policies.sql`; every fixture rolls back. Run `npm test`, `npm run lint`, `npx tsc --noEmit`,
and `npx next build --webpack` from the app directory.

## Behavior and limits

- The driver and all currently accepted passengers see the entire room history, including messages
  before acceptance. Reacceptance restores full history. Missing/future acceptance timestamps remain denied. The roster contains current participants’ names/photos, phone numbers, and optional social links; historical message authors remain name/photo only.
- SQL policies check current membership for queries and Realtime. Booking cancellation revokes
  database access immediately. The open UI rechecks on events, focus, reconnect, history loads,
  sends, and every 15 seconds. Already delivered content cannot be recalled; offline clients can
  retain it until their next successful authorization check. On detected membership loss the
  component clears the timeline and unsubscribes.
- Ride cancellation closes sends but preserves member history. Other ride states allow sends up
  to and including 48 hours after departure. Server and SQL checks enforce this even if the UI is stale.
- One insert creates one room message with `recipient_id = null`. Text is trimmed to 1–2000
  characters at the app boundary. PostgreSQL permits up to 4000; there are no updates, deletes,
  read receipts, edits, DMs, attachments, previews, or presence.
- History uses at most 50 messages per query, ordered by `(created_at, id)` with microsecond-aware
  client sorting. Forward pagination catches missed messages after reconnect; older pages prepend
  without forcing the reader to the bottom. Server responses and events deduplicate by message ID.
- Realtime events are hints: the client re-queries authorized history before displaying messages.
  A missed connection falls back to periodic retrieval and manual retry. Failed sends keep the draft;
  when a response is ambiguous, check the timeline before retrying to avoid a duplicate manual send.
- Only `messages` and `ratings` have the new table RLS. Existing unrestricted application tables
  (including membership sources) remain a project-wide production limitation. This checkpoint does
  not claim complete database hardening.

## Handoff for Pero

The checkpoint also enables rating RLS and adds
`profile_rating_summary(target_profile_id)` returning aggregate-only `{ average, count }` rows.
Empty history is null average / zero count. Raw notes are readable only by the rater and ratee.
`can_rate_ride` derives the current identity and permits only completed-ride driver/passenger pairs.
The ratings UI, dashboards, and root README remain Pero's ownership. Booking, completion, impact, Q&A, and trip-share rules are unchanged. Contact visibility was expanded by the subsequent profile-contact feature: drivers see requester phones and authorized room participants see current member contacts.

## Repeatable live browser verification

From `ride-share-app`, run `npx next build --webpack`, then start the production build
with `npx next start --port 3102`. Use a separate terminal for the fixture.
The fixture uses the configured Supabase project's URL, public key, admin key, and allowed
student email domain from `.env`. It uses admin-generated login links without sending emails.
Microsoft Edge must be installed (or set `CHAT_TEST_BROWSER` to another installed Playwright channel).

```powershell
$env:CHAT_LIVE_TESTS = '1'
$env:CHAT_TEST_BASE_URL = 'http://localhost:3102'
node fixtures/chat/verify-live.cjs
```

This is an opt-in integration test against the configured hosted database. It creates six synthetic
student accounts, a car, one ride, bookings, messages, and a share link. Its `finally`
cleanup deletes the tracked ride, car, and accounts, including dependent fixtures. Cleanup failures
make the command fail and must be resolved before another run. Do not interrupt the process during
cleanup. Existing users and rides are not changed. Screenshots and a result summary go into ignored
`.test-dist/chat/`; no credentials are written there.

The script asserts actual WebSocket frames for each of the three initial members, so periodic
polling cannot hide a broken Realtime subscription. It also checks denied users, pagination, reload,
full history before acceptance, offline recovery, cancellation, keyboard focus, mobile overflow, and the
existing booking/contact/trip-sharing flows. Realtime authentication is set explicitly before
subscribing, and each mounted subscription has its own channel identity.


## Verified results — 2026-09-21

- 230 tests across 20 files passed, including 42 chat contract/server/component tests.
- ESLint, TypeScript, and the Webpack production build passed.
- Migration applied to the configured hosted Supabase; rollback-only schema/policy SQL smoke passed.
- Automated real-browser sessions in Edge passed all 14 scenarios listed in `live-results.json`,
  including actual three-member WebSocket delivery and the then-existing cross-feature flows.
- Mobile (375px) and desktop screenshots were captured; long unbroken text stayed within the viewport.
- Synthetic accounts, ride, car, and dependent fixtures were deleted after the run.

These are automated browser results, not a claim of human manual testing. Development-server runs
showed intermittent composer/input timing failures; the complete regression passed against the
production build. Use the production commands above for repeatable end-to-end verification.

## AI summaries and questions

The room header offers **Summarize chat** and **Ask AI**. Each member sees only their own result.
Questions are independent; nothing is posted to the room or persisted as AI conversation history.
Results show database-backed source excerpts and a message count/cutoff. New messages mark an
answer out of date; refresh is explicit. AI remains available to members of read-only rooms.

The authenticated POST endpoint `/api/chat/assist` uses a separate request from chat Server Actions,
so generation does not queue sends or history reads. The server loads every page through its
initial newest-message boundary, checks current room access before/after the provider call, and
rejects a transcript beyond 1,000 messages or 100,000 serialized characters. It never silently
summarizes a partial history. Five requests per rolling minute are admitted per user across rooms
and app instances; the database stores only admission timestamps. There is no shared AI result cache.

The UI explains that explicit AI requests send room messages to OpenAI. Profile contact fields
are not included; text users typed into messages is included. Requests use `store: false`, a
30-second timeout, no automatic retry loop, and bounded output. This is not a zero-retention promise.
Empty rooms, unsupported answers, missing keys, provider failures, rate limits and oversized rooms
have explicit states. Output is escaped text. Source validation checks message identity; it cannot
prove that the model correctly interpreted those messages, so users should check the sources.

### Synthetic AI evaluation

From the app directory, with the normal OpenAI server configuration:

```powershell
$env:CHAT_AI_LIVE = '1'
node --conditions=react-server --import tsx scripts/evaluate-chat.ts
```

This invokes the configured provider on six synthetic examples in `ai-cases.json`, covering a
confirmed correction, missing luggage information, unresolved proposals, mixed Macedonian scripts,
Albanian and an embedded instruction attack. It asserts expected facts, insufficient-evidence
behavior and real citation IDs; a pass is a small evaluation, not a general accuracy guarantee.
`server-only` is installed explicitly so the same protected production module can run under the
`react-server` Node condition. Normal unit tests mock the model and make no paid requests.

### Extended browser checks

The existing live script calls `verify-ai-browser.cjs` with its synthetic room and users. It uses
browser-intercepted AI answers for repeatable UI checks, while authorization denial, messages,
Realtime and concurrent budget admission use real Supabase operations. Set `CHAT_AI_LIVE=1` to
add one real endpoint question that cites the earliest synthetic message beyond the visible page.
Set `CHAT_AI_FOCUSED=1` to run only the room setup and AI checks. Leave it unset for the full
chat/booking/contact/sharing regression. Screenshots are `ai-desktop.png` and `ai-mobile.png` in
`.test-dist/chat/`.

A cleanup manifest records only synthetic IDs in `.test-dist/chat/cleanup.json`. It is removed
only after cleanup succeeds. If connectivity interrupts cleanup, remove the listed synthetic
rides/cars/users before deleting the manifest or running again. The fixture refuses to overwrite
an unresolved manifest. The old Q&A assertions were removed because that UI is no longer present
in the current app; this run does not claim to verify the earlier Q&A feature.


## Verified results — 2026-09-22

- All 517 tests across 41 files passed. After the responsive correction, all 26 chat component
  tests passed again; full lint, TypeScript and the Webpack production build were clean.
- Both new migrations were applied to the configured development database; rollback-only schema
  smoke tests passed. Types were regenerated from its public schema. Ten simultaneous authenticated
  budget requests admitted exactly five, both in SQL-client and normal Supabase RPC verification.
- Six live synthetic AI fixtures passed. A real authenticated endpoint question cited the earliest
  synthetic room message beyond the first browser page. No real user chat was used for evaluation.
- The final full Edge browser run passed 17 recorded scenarios, including three-member WebSocket
  delivery, late acceptance/full history, private AI sources/questions, stale results, read-only AI,
  concurrent ordinary chat, cancellation/reacceptance, offline recovery, booking lifecycle, contacts
  and trip links. Desktop and 375px mobile screenshots were reviewed; the open panel and composer
  remain reachable without horizontal overflow.
- Two earlier runs hit intermittent Supabase HTTP failures. Their exact synthetic records were
  cleaned through PostgreSQL before retrying; a cleanup manifest now protects interrupted runs.
  The successful final run removed all its accounts, ride, car and dependent records.
