# Build plan — student ride-sharing (Skopje)

**Deadline: Tue 22 Sep, 15:00.** Everything judged must be pushed to GitHub by then.

Stack: Next.js (App Router) + Supabase (Postgres, Auth, Storage, Realtime) + OpenAI.

---

## 1. The one-sentence product

> Students studying in Skopje who travel home to other cities find each other, share one car
> instead of three, and split the real cost of fuel — instead of scrolling six Viber groups.

Every feature below either serves that sentence or gets cut. When in doubt, cut.

---

## 2. How we estimate

This is built with AI for ~95% of feature code, so hours-of-typing is the wrong unit. We estimate
in **cycles**: one cycle = write a good prompt → generate → read the diff → fix what's wrong.
**≈ 20 minutes.** A CRUD screen is 1–2 cycles. A state machine with edge cases is 3–4.

What cycles do *not* cover — and what actually consumes the budget:

| Cost centre | Why it's not promptable |
|---|---|
| Supabase dashboard config | Clicking through auth providers, storage buckets, keys |
| RLS debugging | AI writes plausible-but-wrong policies; failure mode is a silently empty list |
| **Parser quality tuning** | Genuinely iterative. Run real posts, find a failure, adjust, repeat |
| Design polish | Taste-driven, several rounds, no single prompt gets there |
| Seed data realism | Curation is human work |
| Demo recording | Retakes |

**The headline: writing the features is cheap. Tuning, config, and taste are expensive.**
Budget accordingly — the slack goes to the parser and the visual polish, because that is where
the points are.

---

## 3. Scope tiers

Tiers are **priority order**, not a cut list. At the estimates in §6 all three fit inside the
budget with room. If something slips, it slips from the bottom.

### Tier 1 — the spine
- Student email auth + required profile (real name, photo, university)
- Driver: create a ride — route, pickup points, datetime, seats, car, price
- Car consumption lookup → suggested fair price per seat + CO2 saved
- Rider: browse feed, filter, open a ride
- Seat map / fullness on ride card and detail
- Request a seat → driver approves or declines → seat held
- **AI: paste a Viber/FB post → parsed into a pre-filled create-ride form**
- **AI: location normalisation** onto canonical cities + pickup points
- Seeded mock data (40–60 rides, ~25 profiles)
- README (10 points — not optional)

### Tier 2
- AI natural-language search ("Bitola Friday after 4")
- Share-my-trip public link (send to a parent)
- Public Q&A comment thread on a ride
- Personal + platform CO2 saved counter
- AI match explanation lines in the feed
- **Same-gender ride preference filter** (see §8)

### Tier 3
- Unclaimed imported rides (anyone pastes someone else's post)
- In-app 1:1 chat (Supabase Realtime)
- AI spam / safety screening
- Post-ride ratings

Not building, goes in README "what we'd build next": recurring rides, live driver map, native
mobile app, payments.

---

## 4. Data model

Lock this in the **first two hours today**. Three people generating code against a moving schema
is how we lose an afternoon.

```
profiles        id→auth.users, full_name, photo_url, university, phone,
                instagram, facebook, bio, gender, verified_at
cities          id, name_mk, name_en, aliases[], lat, lng
pickup_points   id, city_id, name_mk, name_en, aliases[], lat, lng
car_models      id, make, model, engine_size_l, fuel_type, consumption_l_100km,
                co2_emissions_g_km?, release_year?                      (seed table)
cars            id, owner_id, car_model_id?, make, model, fuel_type,
                consumption_l_100km, color, plate_last3, seats_total
rides           id, driver_id?, car_id?, origin_city_id, origin_pickup_id,
                dest_city_id, dest_pickup_id, departure_at, seats_total,
                seats_available, price_per_seat_mkd, notes, tags[],
                gender_preference(any|same_as_driver),
                status(draft|published|full|completed|cancelled),
                source(native|imported), import_id?, claimed_by?
imports         id, raw_text, source_hint, parsed_json, confidence,
                spam_flags, created_by?
bookings        id, ride_id, passenger_id, seats, message,
                status(requested|accepted|declined|cancelled), decided_at
ride_comments   id, ride_id, author_id, body                            (public Q&A)
messages        id, ride_id, sender_id, recipient_id, body
ratings         id, ride_id, rater_id, ratee_id, score, note
reports         id, reporter_id, target_user_id, ride_id?, reason, body
trip_shares     id, booking_id, token, expires_at
```

Notes:
- `tags` is a `text[]` against a fixed vocabulary — no join table for ride chips.
- `seats_available` is denormalised; keep it correct with a trigger on `bookings`.

### Visibility rules (decided, not configurable)
- Public feed shows the ride, the driver's name and photo — **never** who has applied.
- Driver sees each applicant's full profile.
- Once a booking is `accepted`, the driver and confirmed passengers see each other's contacts
  and social links. Nobody else does.

### RLS
AI writes plausible-but-wrong RLS policies and the failure mode is a silently empty list, not an
error. We write real policies for `rides`, `bookings`, `profiles`, `messages` — budgeted at 2h on
Monday. If they are still fighting us at the end of that block, we go permissive and **write it
in the README's known issues**. Honest costs nothing on the rubric; hidden costs everything.

---

## 5. Routes

```
/                      landing → feed
/login                 magic link, student-domain allowlist
/onboarding            name, photo (required), university
/rides                 feed: filters + NL search
/rides/[id]            detail, seat map, request seat, Q&A
/rides/new             create ride (manual)
/rides/import          paste text → AI parse → prefilled /rides/new
/dashboard/driver      my rides + incoming requests (approve/decline)
/dashboard/trips       my bookings as a passenger
/profile/[id]
/trip/[token]          public share-my-trip page (no auth)

/api/parse             raw text → structured ride
/api/search            NL query → structured filters
/api/explain           batch match explanations
```

---

## 6. AI layer

One module, `lib/ai/`, so all four call sites share the schema and the place vocabulary.

| Function | Job | Tier |
|---|---|---|
| `parseRidePost(text)` | messy post → structured ride JSON | 1 |
| `resolveLocation(raw)` | "Штип" / "Stip" / "кај Мавровка" → canonical id | 1 |
| `parseSearchQuery(text)` | NL query → feed filters | 2 |
| `explainMatch(ride, q)` | one line on why this ride fits | 2 |
| `screenPost(text)` | scam / phone-harvest / junk flags | 3 |

**Use structured outputs (JSON schema mode).** Free-text parsing plus a hand-rolled JSON
extractor is the slowest possible path to the same result.

**`resolveLocation` is hybrid, not pure LLM.** Fuzzy-match against the `aliases[]` columns first;
call the model only on the misses. Faster, cheaper, deterministic on the cases that matter —
which also makes it testable.

What the parser has to survive. **These are the test cases** — collect real posts and keep them
in `fixtures/posts/`:
- Mixed Cyrillic/Latin in one post
- Landmarks instead of addresses — "кај Мавровка", "од Рамстор", "на Автокоманда"
- Implicit dates — "утре навечер", "во петок после 6", "овој викенд"
- Offering a seat vs looking for one, inferable only from phrasing
- Price per person vs per car vs "договор"
- Albanian-language posts

**The cost calculator is arithmetic, not AI.** Distance × consumption × fuel price ÷ seats.
CO2 at 2.31 kg/L petrol, 2.68 kg/L diesel. Fuel price goes in an env var — **verify the current
MKD/L figure before recording**. Put every assumption in the README. Do not let this feature sit
in the "AI does real work" story; it weakens it.

---

## 7. Schedule

Durations below are realistic, not padded. Slack is named as slack rather than quietly absorbed.

### Today, Sun — A + B, ~6.5h each (13 person-hours)

**0:00–2:30, both together — critical path, nothing parallelises before this (~5 person-h)**

| Task | Est |
|---|---|
| Next.js scaffold + deps | 10m |
| Supabase project, keys, env, auth provider config | 45m |
| Schema migration, all tables + `seats_available` trigger | 2 cycles |
| Seed `cities` + `pickup_points` (curation is the slow part) | 40m |
| Seed `car_models`, 50–60 models on MK roads | 1 cycle |
| `supabase gen types` → shared TS types, committed | 10m |

Models to seed: Golf 4/5/6/7, Astra, Clio, Passat, Octavia, Punto, Corsa, Megane, Fabia, Polo,
i30, Ceed, Yaris, Focus, Insignia, Superb, Ibiza, Rio, Civic, Touran, Zafira …

**Then split (~4h each):**

| A | Est | B | Est |
|---|---|---|---|
| Magic link + student-domain allowlist | 40m | `parseRidePost` w/ structured outputs | 2 cycles |
| Onboarding + photo upload (Storage policies are fiddly) | 45m | `resolveLocation` hybrid | 2 cycles |
| Profile page | 1 cycle | **Parser tuning round 1** against real posts | 2h |
| Create-ride form + validation | 2 cycles | | |
| Car picker → consumption prefill → override | 1–2 cycles | | |
| Price + CO2 calculation | 1 cycle | | |

**End of Sunday, all true:** login with a student email works; paste a real Viber post → correct
structured JSON; create a ride manually with a suggested price.

### Mon — A (10h), B (10h), C (5h) = 25 person-hours

**A — morning (~3.5h)**

| Task | Est |
|---|---|
| Feed + filters | 2 cycles |
| Ride detail + seat map | 2 cycles |
| `bookings` + request/approve/decline state machine | 2 cycles |
| Driver dashboard + passenger trips dashboard | 2 cycles |
| State edge cases (double-book, cancel-after-accept, full) | 45m |

**A — afternoon (~3h):** RLS policies (2h, debugging-dominated) · mobile responsive pass (1h)

**B — morning (~2.7h)**

| Task | Est |
|---|---|
| NL search → filters | 2 cycles |
| Match explanation lines (batched) | 2 cycles |
| Share-my-trip link + public `/trip/[token]` page | 2 cycles |
| Public Q&A thread on rides | 1 cycle |
| CO2 saved counter, personal + platform | 1 cycle |

**B — afternoon (~3h):** parser tuning round 2 (1.5h) · unclaimed imported rides (1h) ·
spam screening (1 cycle)

**C — 5h:** seed 40–60 realistic rides + ~25 profiles with photos (1.5h) · collect real
Viber/FB post samples into `fixtures/posts/` (1h) · same-gender preference filter (1 cycle) ·
**README skeleton with real run instructions** (1h) · design polish (1h)

**Evening, together (~3h):** in-app chat if wanted (3 cycles) · design polish pass — this is
several rounds and worth the time, it is what the jury looks at.

**Before bed:** README run instructions must be real and complete, so another team can clone and
run it first thing Tuesday.

**Monday slack: ~5 person-hours.** Spend it on polish or parser accuracy, not new features.

### Tue — 3 people, ~5.5h each, ends 15:00 (16.5 person-hours)

| Time | What |
|---|---|
| 09:00–10:00 | **Another team clones and runs from our README.** One person shepherds, fixes what breaks |
| 09:00–11:00 | Ratings (2 cycles), bug bash, leftover polish |
| 11:00–12:30 | README final, architecture diagram, known-issues list, AI-usage section |
| 12:30–14:15 | Record the demo + retakes |
| 14:15–15:00 | Push, verify GitHub shows the latest commit, check the main flow on a phone |

---

## 8. Safety story

Worth stating plainly in the README, because "how is this safer than a Viber group?" will be asked.

- Student email domain verification gates entry
- Real name + photo required, no throwaway profiles
- Driver approves each passenger
- Contacts revealed only on confirmed booking; the public feed exposes nothing
- **Same-gender ride preference.** A driver may mark a ride as open only to passengers of the
  same gender. Optional on both sides, off by default, never shown as a public attribute of a
  person — it filters requests, it does not label anyone. Standard in carpooling (BlaBlaCar ships
  the same thing) and directly answers the most common reason a student won't get in a stranger's
  car. Frame it in the README as a safety option, not a demographic feature.
- Share-my-trip link — someone outside the car knows who you got in with
- **There is a record** of who was in which car and when. A Viber group has none.
- Report button on profiles and rides

---

## 9. Rubric mapping

| Pts | Criterion | What earns it here |
|---:|---|---|
| 30 | Actually useful | Named user: a UKIM student from Štip who goes home every second weekend and currently scrolls three Viber groups. Behaviour already exists — we organise it. |
| 20 | Demo works | One path: paste post → ride created → rider searches in plain language → requests seat → driver approves → contacts revealed → share-trip link. |
| 20 | AI does real work | Parsing mixed-script, landmark-based, implicit-date Macedonian posts is impossible with regex. NL search + normalisation on top. Not a chat box. |
| 15 | How you built it | Commits spread over Sun/Mon/Tue with real messages. Schema locked early. Honest AI-usage section. |
| 10 | Understandable | README: what, who for, how to run, what's finished, what's next. Tested by another team. |
| 5 | Holds up | `fixtures/posts/` parser test cases from real posts. Known-issues list. Assumptions documented. |

---

## 10. Commit discipline

The rubric gives 4 points for commits spread across build days with messages that say what
changed — and explicitly says not to invent commits to look busier. Commit small and often from
here; don't dump on Tuesday afternoon.
