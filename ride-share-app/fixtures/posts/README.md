# Ride-post parser evaluation

## Optional screenshot and checker observations

Run only the import-pipeline live checks with configured server credentials:

```sh
npm run test:live -- tests/live/pipeline.live.test.ts
```

These checks reuse `public/landing/post-bitola.png` directly, without copying it or logging its
transcription. They assert at least one offer mentioning Bitola in Latin or Cyrillic. A separate
real-model checker observation uses a synthetic Skopje–Veles draft and fake routing, fuel-cost,
and duplicate executors, so no database or routing network requests occur. The 52 km distance and
100 MKD/L petrol price are explicit test fixtures, not claims about current roads or pump prices.
The calculated estimate is 121 MKD per available seat (364 MKD total / three seats, rounded).

Ordinary `npm test` excludes these provider calls. See
[the live evidence record](../../../docs/verification/ai-import-live.md) for actual outcomes,
including a failed first price-check run, observed model identifiers, timings, and limitations.

## Text-parser fixture evaluation

Run the live fixture evaluation from `ride-share-app`:

```sh
npm run eval:parser
```

The command reads `OPENAI_API_KEY` and the optional `OPENAI_MODEL` from `.env.local`. It fixes the
evaluation clock at `2026-09-20T12:00:00+02:00` in `Europe/Skopje` so relative-date expectations are
repeatable.

## Round 1 result

The five anonymized fixtures cover mixed Cyrillic/Latin text, Macedonian and Albanian, landmarks,
relative or incomplete dates, offers versus requests, per-person prices, negotiable prices, and
whole-car prices.

| Field | Correct | Accuracy |
| --- | ---: | ---: |
| Classification | 5/5 | 100% |
| Route | 5/5 | 100% |
| Departure | 5/5 | 100% |
| Seats | 5/5 | 100% |
| Price | 5/5 | 100% |

This is a small curated regression set, not a claim of production accuracy. Model output may vary
between runs. Date-only posts intentionally leave departure empty for manual review instead of
inventing a time, and threshold times such as “after 6” use the earliest boundary with a warning.
Locations are restricted to supplied city and pickup candidates, then resolved from the preserved raw
place text through Track A's deterministic alias matcher before a structured model fallback. The
integrated live run retained 5/5 route accuracy. Vehicle, distance, and other fields remain empty
unless the source post states them clearly.
