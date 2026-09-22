# Testing and what we tried to break

## Automated tests

Run from `ride-share-app/`:

```sh
npm test            # 595 tests in 44 files, ~4 s, no network and no OpenAI credits
npm run lint
npx tsc --noEmit
```

Tests sit next to the code they cover (`*.test.ts`). They focus on the parts where a bug would hurt
a real user: the AI parsers and their guards, location resolution, ride-draft validation, price and
CO2 arithmetic, booking eligibility and seat holding, feed filters, share links, comments, ride
completion, CO2 counters, ratings and the ride-offer workspace UI. Model responses are mocked, so
tests check what *our code* does with good, bad and malformed AI output.

## Live AI evaluations (use real OpenAI credits)

| Command | Fixtures | Last recorded result |
| --- | --- | --- |
| `npm run eval:parser` | 5 anonymised real group posts ([fixtures/posts](../ride-share-app/fixtures/posts/README.md)) | 5/5 on classification, route, departure, seats and price |
| `npm run eval:search` | 12 search phrases in English and Macedonian Cyrillic/Latin ([fixtures/search](../ride-share-app/fixtures/search/README.md)) | 12/12 |
| `npx tsx scripts/evaluate-offers.ts` | 4 multilingual ride descriptions incl. an outbound + return trip | 4/4 |

Each run uses a fixed clock so "tomorrow" and "Friday" give repeatable answers. These are small
curated sets: a regression signal, not a claim about production accuracy.

## What we tried, what broke, what we fixed

| We tried | What happens |
| --- | --- |
| Empty or one-word input | Rejected before any AI call with a readable message (post import needs 10+ characters, search 2+, ride description 2+). |
| Huge input | Capped server-side: post import 5,000 characters, ride description 6,000, search 300. Longer input gets a 400 with the limit in the message. |
| Macedonian Cyrillic, Latin transliteration, mixed script, English | Covered by the live fixtures above. |
| A place that isn't in our city list | Stays **unresolved**, and the driver must pick it manually. A model-invented city or pickup ID is thrown away (`lib/ai/resolve-location.ts`). |
| A post with a date but no time | Departure is left empty for review instead of inventing a time. |
| Seats or price not mentioned | Left empty; never guessed. |
| OpenAI down, slow or missing key | Search shows "AI search timed out. The manual filters are still available."; match explanations fall back to plain ride facts; ride description says "Retry or enter details manually". The ride list never disappears because of the AI. |
| Route service (OSRM) down | The km field stays empty and editable; a manual value survives unrelated edits. |
| Two people booking the last seat at once | A database trigger is the final guard against overbooking. |
| Double-clicking Publish / retrying after a network error | Submission IDs make publishing idempotent: one ride, not two. |
| A browser in another timezone (Los Angeles) | Departure times are still entered and saved in Skopje time (browser check in `scripts/verify-offers.cjs`). |
| Signed-out or non-student users hitting the APIs | 401/403 with a message; student domain is checked before the email is sent and again after sign-in. |

Review findings and their fixes are written up in [docs/verification/](verification/). Bugs found
while building show up in the history as a `fix(...)` commit following the feature commit.

## Not tested / known gaps

- Languages other than Macedonian and English.
- Load: the public OSRM server is rate-limited to one request per 1.2 s for the whole app.
- A driver approving a booking at the exact moment the ride departs or is completed
  ([ticket 06](tickets/21-09-pero/06-atomic-booking-decisions.md), deferred).
- Row-level security only covers messages and ratings (see README known issues).
