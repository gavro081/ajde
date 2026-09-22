# Ajde - Student ride sharing between Macedonian cities

Ajde helps students in Skopje find a shared ride home to their city, split the real fuel cost, and
keep extra cars off the road. Drivers describe a trip the way they'd write it in a Viber group, or
upload a screenshot of their Facebook post, and AI turns it into a checked ride listing they review
before publishing.

**Live demo:** [ride-share-app-delta.vercel.app](https://ride-share-app-delta.vercel.app) · **Backup video:** _TODO: video link_

## Who it is for

**A student studying in Skopje who goes to their home town most weekends.**
Today they scroll six or more Facebook and Viber groups, one per route. Each gets 10–20 posts a day,
all in free text, and a post is buried within minutes. The driver on the other side guesses a price
and often leaves with empty seats.

- **We talked to students before building.** We interviewed student friends who live in different
  cities and travel home from Skopje. What we learned:
  - **Buses are often full.** Students can't get on, or they go to the station much earlier just
    to get a seat.
  - **Buses are slower and less convenient** than a car going the same way.
  - **The other option is driving, and many students drive alone.** Several of them make the same
    trip in separate cars when they could split one car's fuel cost and save the fuel and CO₂.

  That is what Ajde is built around: find a seat in a car already going your way, and fill the
  empty seats in yours.
- **The problem is real, not assumed.** The landing page shows real ride posts from these groups
  this week ([`public/landing/`](ride-share-app/public/landing),
  [`about-sections.tsx`](ride-share-app/components/landing/about-sections.tsx)). Those posts are
  also why the AI has to read Cyrillic shorthand timetables.
- **Why they'd still use it next month:** the trip home repeats every week, and the price split,
  saved car and ratings carry over from one trip to the next.
- **Green, honestly:** three passengers in one car means three fewer car trips. The CO₂ counter
  only counts completed rides with a real distance and a petrol or diesel car
  ([assumptions](docs/SAFETY.md#co2-impact-assumptions)). **The homepage totals are mostly seeded
  demo history**, not real usage: about 75 completed trips, 62 participants, ~1,425 L of fuel and
  ~3,725 kg of CO₂, of which 72 trips come from seeded data.

## What you can do in it

1. Sign in with a university email (for example `@students.finki.ukim.mk`) and complete a profile with a photo.
2. **Find a ride:** filter by route, date and seats, or just type "Bitola Friday after 4".
3. **Offer a ride:** type "Skopje to Ohrid Saturday 4pm, back Sunday evening, 3 seats", or paste an
   existing group post. Review the draft, pick your car, see the suggested fair price per seat, publish.
4. Request a seat. The driver accepts or declines. Contacts are revealed only after acceptance.
5. Ask questions under the ride, chat in a private ride room (with AI summaries and "Ask AI" to
   catch up on what was agreed), and share your trip with family through a link that expires.
6. After the trip, the driver marks it completed. Both sides rate each other, and the CO₂ saved is counted.

## How the AI works

```mermaid
flowchart TD
  S["Facebook screenshot"] --> R["1 · Reader (vision model)<br/>transcribes each post, keeps original script,<br/>marks unreadable bits [?]"]
  R --> P0["Driver picks one post"]
  T["Viber text / typed description"] --> P
  P0 --> P["2 · Parser (structured output)<br/>gets current Skopje time + our city list"]
  P --> G["Code guards<br/>locations must match our DB · invented times cleared<br/>seats & price never guessed"]
  G --> C["3 · Checker (model with tools, ≤4 rounds / 6 calls)"]
  C <-->|calls| T1["road_distance → OSRM"]
  C <-->|calls| T2["fair_price → our fuel-cost formula"]
  C <-->|calls| T3["find_similar_rides → rides DB"]
  C --> E["Evidence guard (code)<br/>keeps only findings that cite a real tool result"]
  E --> V["Review page: warnings, fair-price check, possible duplicates"]
  V --> F["Driver edits every field in the form"]
  F --> I["Server re-validates → ride published"]
  R -. "unreadable / provider error" .-> X["Readable error: 'paste the text instead'"]
  C -. "tool or model fails" .-> V
```

| AI job | File | What would break without AI |
| --- | --- | --- |
| Read a messy group post into a ride draft | [`lib/ai/parse-ride-post.ts`](ride-share-app/lib/ai/parse-ride-post.ts) | Posts mix Cyrillic, Latin, landmarks ("од Рамстор") and relative dates; regex can't keep up |
| Turn a free-text trip description into one draft per trip | [`lib/ai/parse-offer-description.ts`](ride-share-app/lib/ai/parse-offer-description.ts) | Return trips, shared details and "Saturday 4pm" in Skopje time |
| Map a place name the aliases missed onto our city list | [`lib/ai/openai-location-fallback.ts`](ride-share-app/lib/ai/openai-location-fallback.ts) | Spelling variants and transliterations |
| Turn a search phrase into filters | [`lib/ai/parse-search-query.ts`](ride-share-app/lib/ai/parse-search-query.ts) | "Ohrid slednive nekolku dena okolu 5" |
| Summarise a ride chat and answer questions about it, citing the messages | [`lib/ai/chat-assistant.ts`](ride-share-app/lib/ai/chat-assistant.ts) | Catching up on a long chat: "where are we meeting, and who's bringing a big bag?" |
| Explain why a ride matches your search | [`lib/ai/explain-match.ts`](ride-share-app/lib/ai/explain-match.ts) | (falls back to plain facts) |
| **Reader:** read a Facebook screenshot into separate posts | [`lib/ai/read-screenshot.ts`](ride-share-app/lib/ai/read-screenshot.ts) | Drivers already have the post as an image; retyping Cyrillic from a screenshot is the step people skip |
| **Checker:** cross-check the draft by calling tools the model chooses | [`lib/ai/check-ride-draft.ts`](ride-share-app/lib/ai/check-ride-draft.ts), [`ride-check-tools.ts`](ride-share-app/lib/ai/ride-check-tools.ts) | Spotting that 1,200 MKD for Skopje → Veles is 10× the fuel cost, or that the same ride is already posted |

The import flow is three separate AI jobs passing work along: **reader → parser → checker**, with
the driver choosing a post between the first two. The checker decides for itself which tools to
call. A live run is recorded in [docs/verification/ai-import-live.md](docs/verification/ai-import-live.md),
including a run where the model skipped the price tool. Screenshot import and the checker are
behind a server switch, `AI_IMPORT_PIPELINE_ENABLED=true`, which is on in the live deployment and in
`.env.example`. When it's off, text import works as before, without the checker.

**When the AI is confidently wrong:** the model never publishes anything. It only fills a draft
that a person reviews, and the server validates the draft again on submit. The checker can't
make things up either: code keeps a finding only if it cites a successful tool result, and code
writes the final warning text. It never changes the driver's fields. A price is flagged only if
it's more than 2.5× or less than 0.3× the calculated fuel cost. The model can't
invent a city: every place ID must exist in our database or it's discarded. Invented departure
times are cleared, and missing seats or prices stay empty. Uncertain output shows warnings in the
form. If OpenAI is down, search falls back to the manual filters and the ride list still loads.
The price and CO₂ numbers are deliberately plain arithmetic, not AI, so they can be checked by
hand. More detail in [docs/AI.md](docs/AI.md).

### What is real and what is not

| Real | Demo / assumption |
| --- | --- |
| Live OpenAI calls for parsing, search and explanations | 25 demo profiles and 50 upcoming demo rides, seeded so the feed isn't empty (flagged `demo_seed`, excluded from CO₂ totals) |
| CO₂ and fuel arithmetic behind the homepage totals | 35 more demo profiles and 72 completed past trips with accepted bookings (flagged `seeded_history`), **counted** in the homepage totals so the counters aren't near zero |
| Supabase auth, database, photo storage and Realtime chat | Fuel prices are values we set in `.env`, not a live feed |
| Road distance from the public OSRM router | Car fuel consumption is a representative, rounded value per catalog model |
| Real group posts on the landing page and in the parser tests | No payments: the app suggests a price, and passengers settle with the driver themselves |

## How to run it

You need Node.js 20.9+, a Supabase project, `psql`, and an OpenAI API key.
[docs/SETUP.md](docs/SETUP.md) has every step and environment variable.

```sh
git clone <repository-url>
cd lightweight-repo/ride-share-app
npm ci
cp .env.example .env.local        # fill in Supabase URL/keys, DATABASE_URL, OPENAI_API_KEY, fuel prices

# create the schema and demo data (run once against an empty Supabase database)
set -a; . ./.env.local; set +a
for m in supabase/migrations/*.sql; do psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$m" || break; done

npm run dev                       # http://localhost:3000
npm test                          # 864 tests, no network needed
```

Only addresses on domains in `STUDENT_EMAIL_DOMAINS` can join. **Sign up** emails a magic link.
**Sign in** doesn't send email: the server uses `SUPABASE_SECRET_KEY` to sign the user in directly,
so demos don't hit email rate limits (see known issues).

**Tried by someone outside the team:** we gave another hackathon team a test account on the live
app and collected their feedback.

## What is finished and what is not

**Finished and working end to end:** student sign-in and onboarding; manual, described and
imported ride offers (Viber text or Facebook screenshot, checked by the tool-using checker); car catalog with fuel-cost and CO₂ suggestion; automatic road distance;
feed with filters and AI search; seat requests with accept, decline and cancel; contact reveal
after acceptance; ride Q&A; share-my-trip links; private ride chat with AI summaries and questions; ride completion; ratings;
personal and platform CO₂ counters.

**Not finished:**

- The checker runs on imported posts only, not yet on typed ride descriptions. One screenshot per upload, no batch import.
- Unclaimed imported rides, reporting users, AI spam screening, recurring rides, payments, live location.

### Known issues

- **Sign in skips email confirmation, on purpose, for the demo.** Anyone who knows an allowed student
  address can sign in as that user. Before a real launch, Sign in must go back to magic links
  or passwords.
- **Security is not production-ready.** Row-level security is enforced only on chat messages and
  ratings. The other tables rely on server-side checks in our code, so a user calling Supabase
  directly with the public key could bypass them.
- Our AI accuracy numbers come from small test sets: 5 posts, 12 searches, 4 descriptions, and
  one screenshot for the full pipeline. The model can still be wrong, and doesn't always call
  the tool it should, which is why every draft goes through human review.
- Screenshot import adds a model call before the checker's tool loop, so it's slower than
  pasting text: a few seconds in our runs.
- A booking approved at the exact moment a ride departs isn't guarded by a transaction
  ([ticket](docs/tickets/21-09-pero/06-atomic-booking-decisions.md)).
- Distance is city-centre to city-centre, not pickup to pickup ([why](docs/adr/0001-city-to-city-road-distance.md)).
  The free OSRM server is shared, so we rate-limit it and fall back to manual km.
- CO₂ is estimated only for petrol and diesel cars. Fuel prices must be updated by hand.
- Migrations are applied with a `psql` loop, not a migration tool.

### What we tried to break

Empty input, huge input, four scripts and languages, unknown places, OpenAI down, OSRM down, double
submits, two people booking the last seat, and a browser in another timezone. Each case and its
result is in [docs/TESTING.md](docs/TESTING.md), along with the test suite and live AI evaluations.

## How we built it

**Team:** Filip Gavrilovski (Gavro), Dimitar Arsov (Dimi), Petar Srbinoski (Pero).

**Stack and why:**

- **Next.js (App Router):** UI and server API in one TypeScript project, and the OpenAI key never
  reaches the browser.
- **Supabase:** Postgres, auth, photo storage and Realtime chat from one service, with row-level
  security available in SQL. That saved a day of backend setup.
- **OpenAI structured outputs + Zod:** the model must return our exact draft shape. The same Zod
  schema validates the form and the server.
- **OSRM:** free road distances with no API key ([research](docs/research/free-road-distance-api.md)).
- **Vitest:** fast tests with mocked AI.

**How we used AI.** Most of the code was written by AI coding agents. Our
master plan estimates about 95% of feature code, and that let us spend our time on the parts AI
can't decide for us. We decided the scope and the data model, and who sees whose contact details.
We chose which numbers must *not* come from AI, and where a human has to review. We tuned the parser
on real posts, wrote the guards, and checked the security rules. Each day we wrote a plan, split it
into two parallel tracks so we didn't edit the same files, generated the code, and read and fixed the
diffs. After that came tests and a verification write-up. The plans are in
[archived-plans/](archived-plans/README.md), and review findings are in [docs/verification/](docs/verification/).

**Commits:** about 170 Conventional Commits over 20–22 September, on feature branches merged into
`main` ([CONTRIBUTING.md](CONTRIBUTING.md)). Bugs appear as `fix(...)` commits after the feature
that introduced them.

## What we'd build next with another week

1. Batch screenshot import, and run the checker on typed ride descriptions too. Then add
   evidence-backed spam and safety checks as another checker tool.
2. Row-level security on every table, then a public launch to FINKI students.
3. Recurring rides ("every Friday 15:00 Skopje → Bitola") and notifications when a matching ride appears.
4. Unclaimed imported rides, so passengers can find drivers who only post in Viber, plus reporting and AI spam screening.
5. **Groups beyond students:** let companies and organisations set up their own private group
   (verified by work email domain, the same way universities work today). Colleagues could share
   daily commutes and trips between offices, and the organisation would see its CO₂ savings.
   Employers are a big second market: bigger than students, and they pay for sustainability numbers.
6. A mobile app or PWA with push notifications, and pickup-level distances.

## Repository map

```text
.
├── ride-share-app/            the Next.js app
│   ├── app/                   pages, API routes, server actions
│   ├── components/            UI components (landing, discovery, chat, ratings)
│   ├── lib/ai/                every AI step and its guards  ← start here
│   ├── lib/                   rides, bookings, auth, sharing, impact, Supabase clients
│   ├── fixtures/              real-post, search, chat and rating test fixtures
│   ├── scripts/               live AI evaluations and browser verification
│   └── supabase/              migrations, seed data, schema smoke test, DATABASE_MODELS.md
├── docs/                      setup, AI, safety, testing, ADRs, verification records, glossary
└── archived-plans/            master plan and the daily plans we built from
```
