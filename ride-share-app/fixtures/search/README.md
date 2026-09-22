# Natural-language search evaluation

Run the deterministic/mocked regression suite with:

```bash
npm test
```

Run the separate live OpenAI evaluation with a configured server-only `OPENAI_API_KEY`:

```bash
npm run eval:search
```

The live evaluator uses the fixed instant `2026-09-21T10:00:00Z` and the `Europe/Skopje`
timezone so relative-date results are reproducible. It sends the canonical test vocabulary and
never reads or writes production ride data.

## Coverage

- Macedonian Cyrillic and Latin transliteration
- Albanian phrasing
- a landmark that must resolve to its parent city
- missing criteria that must remain null
- an unknown city that must not receive a fabricated ID
- an unsupported gender request that must not alter the separately controlled feed toggle
- relative dates and after-time boundaries

## Historical live results (before independent date/time filters)

Run on 21 September 2026 with `OPENAI_SEARCH_MODEL=gpt-5.4-mini`: **8/8 fixtures matched every
expected route, lower departure bound, and seat field**.

| Fixture group | Result | Notes |
| --- | --- | --- |
| English and Macedonian Friday-after-16:00 | Pass | Both produced `2026-09-25T14:00:00Z`, which is 16:00 in Skopje. |
| Macedonian Latin relative date + seats | Pass | “utre” resolved from the fixed clock and retained two requested seats. |
| Albanian phrasing | Pass | Tetovo, Friday-after-16:00, and two seats were extracted. |
| Landmark origin | Pass | Mavrovka resolved deterministically to its parent city, Skopje. |
| Missing fields | Pass | Missing date and seats remained null. |
| Unknown canonical city | Pass | Berovo remained unresolved and produced review warnings instead of a fabricated ID. |
| Unsupported gender request | Pass | Destination/date were retained while the unsupported preference became a warning. |

The live run made real provider calls; the normal `npm test` suite remains fully mocked and does
not consume API credits.

## Known limitations

- Search resolves only the canonical city and pickup-point catalog. Unknown places require manual
  correction even when the model recognizes the name.
- The feed accepts one origin, one destination, one optional inclusive date range, and one
  independent recurring clock window. Bookings are always one seat. More complex requests
  are reduced to supported filters and accompanied by review warnings.
- Match explanations are evaluated separately because feed rendering must not depend on them.
- Match explanations are capped at 24 visible cards per batch. Missing-key, timeout, malformed, or
  unsupported provider output falls back to a short explanation assembled from server-reloaded
  route, departure, seat, and price facts.

## Integration handoff

- Optional server-only model overrides: `OPENAI_SEARCH_MODEL` and `OPENAI_EXPLAIN_MODEL`; both fall
  back to `OPENAI_MODEL` and then `gpt-5.4-mini`.
- Natural search is `POST /api/search`; batched explanations are `POST /api/explain`.
- Manual feed filters remain functional when either provider call fails.
- The same-gender discovery toggle is independent from AI search and is never included in prompts,
  search responses, explanation facts, or ride-card labels.
- No migration or generated database-type change is required for this track.


## Independent date/time regression run — 2026-09-22

`npm run eval:search` with the configured `gpt-5.4` model passed **12/12** fixtures
at the fixed reference instant `2026-09-21T10:00:00Z`. This includes the exact
`Baram prevoz do ohrid nakaj 5, slednive nekolku dena` query, its Cyrillic equivalent,
a time without any date, and a date range without any time. The exact query resolved
to Ohrid, September 21–23 inclusive, and 16:00–18:00 on each day. These are a small
regression sample, not a guarantee of arbitrary-language accuracy.

The evaluator checks independent clock bounds and returns a nonzero exit code for
mismatches. Normal unit tests use model stubs and do not make paid API requests.
