# How the AI works

Detail behind the AI summary in the [README](../README.md#how-the-ai-works).

## Import-to-ride boundary

```mermaid
flowchart LR
  Post[Group post] --> Parse[Structured parser]
  Parse --> Validate[Schema + canonical-ID guards]
  Validate --> Import[(imports)]
  Import --> Review[Human review]
  Review --> Form[Shared ride form]
  Form --> Server[Server validation]
  Server --> Ride[(cars + rides)]
```

Model output never publishes a ride directly. Imported and manually entered rides use the same
draft contract, and the stricter publishable schema is checked again on the server.

## Group-post parser (`lib/ai/parse-ride-post.ts`)

`parseRidePost` uses the OpenAI Responses API with a Zod-backed structured-output schema. It is
designed for informal posts containing Macedonian Cyrillic, Latin transliteration, mixed scripts,
Albanian, landmarks, relative dates, offer/request wording, and several price modes.

The parser receives:

- An explicit current timestamp and the `Europe/Skopje` timezone
- Only the canonical city and pickup candidates loaded from Supabase
- Instructions to preserve uncertainty as warnings and leave unknown fields null
- The same partial ride-draft contract the review form consumes

After the model responds, ordinary code resolves the preserved raw origin/destination wording
through the canonical location resolver instead of trusting model-supplied IDs. Canonical names and
aliases match deterministically; only genuine misses may use the separate structured model fallback.
Pickup matches derive their city from the database vocabulary, fabricated IDs are rejected, and an
unresolved place clears model IDs and forces manual review. Additional guards clear invented
departure times and flag low-confidence output. The raw post and structured result are stored
together for the review step.

## Natural-language search (`lib/ai/parse-search-query.ts`, `lib/ai/explain-match.ts`)

Search dates and clock times are independent. Time-only searches apply to all upcoming rides;
date ranges apply the clock window on each selected day in `Europe/Skopje`, including DST changes.
The manual filters expose optional from/through dates and at-or-after/before times. A from date
alone means that single day; through dates are inclusive. Clock starts are inclusive and ends
exclusive; a start later than its end selects an overnight window on the selected calendar dates.
“Next few days” / “slednive nekolku dena” defaults to today plus the following two days, with a
review warning. “Nakaj 5” defaults to around 17:00 (16:00–18:00), with an afternoon-assumption warning.
The interpretation and editable controls show these choices. `dateFrom`/`dateTo` and
`timeAfter`/`timeBefore` are independent result fields; legacy `after`/`before` URL bounds remain
supported. The feed scans ordered pages until it finds 100 matches or exhausts the range, so
filtering out early rides does not hide later matches. This avoids a database migration, though
very broad time-only searches may need to read many pages.

`parseSearchQuery` separately turns a short search such as “Bitola Friday after 4” into nullable,
schema-validated origin, destination, time-bound, and seat fields. Canonical locations are resolved
against the same database vocabulary, unsupported criteria remain warnings, and only validated URL
filters reach the feed query. `explainMatch` receives a bounded batch of server-reloaded matching
ride facts and the parsed search context. Invalid, timed-out, missing-key, or unsupported responses
fall back to deterministic explanations; AI failure never removes the underlying ride results.

## Describing ride offers (`lib/ai/parse-offer-description.ts`)

On `/rides/new` a driver types one or several trips the way they would in a group chat ("Skopje →
Bitola Saturday 4pm, back Sunday evening, 3 seats"). The model returns one draft per trip; each
draft opens in its own tab and must be published separately. Seats and price are never guessed,
ambiguous times are flagged for review, and **Undo fill** restores the form. Full behaviour:
[ride-share-app/RIDE_OFFERS.md](../ride-share-app/RIDE_OFFERS.md).

## Road distance (not AI)

Once both cities are known, `/api/rides/distance` asks the public OSRM router for the city-to-city
driving distance. Our code makes this call, not the model. Failure leaves the km field editable.
Why city-to-city: [ADR 0001](adr/0001-city-to-city-road-distance.md).

## Fair price and CO2 (not AI)

The fair-price and CO2 calculator is intentionally **not AI**. It uses transparent arithmetic:

```text
distance_km × consumption_l_100km / 100 × fuel_price_mkd_l / seats
```

Tailpipe factors are 2.31 kg CO2/L for petrol and 2.68 kg CO2/L for diesel. Other fuel types are
reported as unsupported rather than receiving an invented conversion factor, and the driver may
always override the suggested price.


## Screenshot pipeline — PLACEHOLDER (in progress)

> **TODO:** being built on a separate branch and not merged yet. Planned: a group-chat screenshot
> goes through a **reader** (vision model extracts the text), then the **parser** above, then a
> **checker** model that calls tools (`road_distance`, `fair_price`, `find_similar_rides`) to
> cross-check the draft before human review. Plan:
> [archived-plans/2026-09-22/22-09-ai-pipeline.md](../archived-plans/2026-09-22/22-09-ai-pipeline.md).
