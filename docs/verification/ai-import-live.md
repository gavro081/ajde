# Optional live import-pipeline observations

Ticket [#10](https://github.com/AI-Tech-Summit-Filip-Avramchev/lightweight-repo/issues/10), run after the required checker and screenshot workflow were integrated. These quality observations are separate from the required [capability spike](ai-import-capabilities.md). They are a small sample, not a production accuracy assessment or provider-retention guarantee.

## Reproduction and fixture context

From `ride-share-app`, with an authorized server key in the environment or the existing live-test environment configuration:

```sh
npm run test:live -- tests/live/pipeline.live.test.ts
```

[The tests](../../ride-share-app/tests/live/pipeline.live.test.ts) invoke the actual production `readScreenshot` and `checkRideDraft` runners. No injected model output, forced tool selection, alternate prompt, or production implementation change was used. Normal `npm test` excludes all live-test files. The command above limits the run to these two observations rather than running the older live suite.

- **Screenshot:** the existing `public/landing/post-bitola.png`, 31,260 bytes (SHA-256 `4bd2d941d7e26a9067482c6190ceeabd3c1017baa28bb26fa7067860f23c4d9c`), read directly into memory. The assertion requires at least one post classified as `offer` containing `Bitola` or `Битола`. No additional image copy or transcript was written or logged.
- **Price checker:** synthetic canonical Skopje → Veles draft, 23 September 2026 at 15:00 Europe/Skopje, three available seats, 1,200 MKD per seat, missing distance and unknown car, fixed clock 22 September 2026 at 12:00 Europe/Skopje. Fake routing returns **52 km**, fake duplicate search returns no rides, and the fake fair-price executor calls real `calculateFairPrice` with explicit fixture configuration **petrol 100 MKD/L, diesel 95 MKD/L**. Defaults are petrol and **7 L/100 km**, giving **364 MKD total fuel cost** and **121 MKD per seat**, rounded by the existing arithmetic. No real routing or database access occurs.
- **Provider:** existing OpenAI SDK 7.20.0, requested `gpt-5.4-mini`, observed response model **`gpt-5.4-mini-2026-03-17`** in every completed response. No `OPENAI_MODEL` or `OPENAI_CHECK_MODEL` override was configured. Requests retain production `store: false`, 15,000 ms request timeout, and zero retries. Credentials were loaded only into process memory for the local run; no environment file was copied into the worktree.

The test observer reads only returned model metadata into its log. It logs counters, booleans, requested/resolved model identifiers, timestamps, and elapsed time; assertions avoid printing screenshot text on failure.

## Actual outcomes, including failure

All timestamps below are UTC on **22 September 2026**; Europe/Skopje was UTC+2.

| Run | Check start | Outcome | Observed elapsed time | Evidence |
| --- | --- | --- | --- | --- |
| 1 | 11:10:16.927 | Screenshot passed | 4,538 ms | Three posts, one offer; the Bitola assertion passed. |
| 1 | 11:10:21.466 | Price check failed its assertion | 5,172 ms | Checker returned `checked`, but the fake `fair_price` executor was not called. Detailed call counters were not captured in this initial version, so the reason cannot be distinguished between omitted selection and rejected arguments from this record. This is not a successful price-check observation. |
| 2 | 11:11:16.501 | Screenshot passed | 1,863 ms | Three posts, one offer; the Bitola assertion passed again. |
| 2 | 11:11:18.365 | Price check passed | 4,774 ms | Three successful tool calls, zero tool errors, and one actual `fair_price` execution. Trace contained the deterministic 121 MKD estimate. The code-written warning contained 1,200 and 121 MKD, and the driver's price stayed 1,200 MKD. |

Before run 2, only safe pre-assert diagnostic counters and an explicit TypeScript argument type were added to the live test. The fixture, clock, model, prompts, fake tools, expected arithmetic, and production code were unchanged. Both live tests passed on run 2; the earlier failure remains part of the evidence. No further repetitions were used to select a better result.

These timings include the complete public operation and the metadata observer, not an isolated provider latency measurement. They are observations rather than guarantees. One screenshot and one synthetic route do not establish multilingual accuracy, pricing fairness, real road distance, duplicate-detection quality, or stable model tool selection. The first failed price observation demonstrates that a successful checker status is not proof every available tool was requested. The UI must continue to show actual evidence and retain human review.

Before committing these optional checks, normal verification passed: **788 tests in 59 files**, `npm run lint`, and `npx tsc --noEmit` after `next typegen`. The live tests are excluded from that normal count. The changes remain local; no remote repository or issue state was changed.
