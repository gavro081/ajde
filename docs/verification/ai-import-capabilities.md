# AI import model capability verification

Ticket [#4](https://github.com/AI-Tech-Summit-Filip-Avramchev/lightweight-repo/issues/4), prerequisite for [#3](https://github.com/AI-Tech-Summit-Filip-Avramchev/lightweight-repo/issues/3).

## Observed live results

The temporary, uncommitted Node.js spike ran successfully on 22 September 2026, starting at **10:33:56 UTC / 12:33:56 Europe/Skopje**, using the existing `openai` SDK **7.20.0** and a configured API key loaded only into process memory from the local application environment. No model overrides were configured: `OPENAI_MODEL`, `OPENAI_CHECK_MODEL`, and `OPENAI_VISION_MODEL` were absent. The proposed fallback **`gpt-5.4-mini`** was therefore tested directly; all three responses reported **`gpt-5.4-mini-2026-03-17`**.

| Probe | Input and assertion | Observed result |
| --- | --- | --- |
| Image input and structured transcription | Synthetic 1100 × 260 PNG (16,591 bytes), rendered entirely in memory: a Latin-script Bitola–Skopje ride offer with departure 08:30, three seats, and 450 denars. Sent as a data URL with `detail: "high"`. Asserted legibility, offer classification, Bitola, and 08:30 in the transcription. | Passed, completed response, **8,464 ms**. |
| Model-selected function call | Offered `road_distance` with a strict integer origin/destination schema and **`tool_choice: "auto"`**. Asked for route 1 → 2 and evidence available only from the routing service. | Model selected `road_distance` with `{ "originCityId": 1, "destinationCityId": 2 }`; call ID **`call_Yd17Wzgivo2wePS6zFct6qVN`**. |
| Matching output consumed in continuation | Validated the arguments; executed a synthetic routing executor returning `{ "distanceKm": 73.25, "evidenceToken": "routing-fixture-Q7M2" }`; supplied that result with the exact matching `call_id`. Requested a structured final response with tools disabled. | Passed: the final object exactly matched both service values. Both tool rounds took **2,682 ms** in total. |

All requests used **`store: false`**, a **15,000 ms timeout**, and **zero retries**. There were no provider errors or failed assertions in this run. The local spike was removed after verification; neither credentials nor PNG bytes/data URLs were written to files or logs. Only assertion results and synthetic tool evidence were logged. No real screenshot, database write, or OSRM request was used. This is a capability check, not a claim of real-world screenshot accuracy or routing accuracy; the distance above is an explicit fixture value.

## Verified implementation choices

- Resolve checker models from non-empty, trimmed `OPENAI_CHECK_MODEL`, then `OPENAI_MODEL`, then **`gpt-5.4-mini`**. The fallback is verified by this run; newly configured overrides still need their own capability check.
- Use `OPENAI_MODEL`, falling back to the same verified model, for image reading. A separate vision model was unnecessary, so do **not** introduce `OPENAI_VISION_MODEL` for this implementation.
- Keep provider access on the server and use the existing SDK. The spike was a server-side Node process, with no browser access or agents framework.
- The successful image and final tool response used `client.responses.parse` with `text.format: zodTextFormat(schema, name)` from `openai/helpers/zod`; inspect `output_parsed` and reject missing/invalid output. Function-call rounds used `client.responses.create`.
- For stateless continuation, retain the original input, append **all** ordered response output items normalized with `toResponseInputItems` from `openai/lib/responses/ResponseInputItems`, then append each `{ type: "function_call_output", call_id, output: JSON.stringify(result) }`. Do not keep only message items or only function calls. The successful probe used this sequence without `previous_response_id`.
- Requests included `include: ["reasoning.encrypted_content"]` for compatibility with reasoning output during stateless replay. This particular response contained only a function-call item and **no reasoning item**, so encrypted-reasoning replay itself was not exercised.
- The final continuation retained the tool definitions and set `tool_choice: "none"`, successfully producing the requested schema. Production must separately enforce the four tool-capable rounds/six-call budget, validate arguments/results, guard evidence, and fail open; this small spike does not test those implementation requirements.

The installed SDK README documents ordered output replay, and the actual SDK helper was inspected before use. Official documentation describes the [function-call/output cycle](https://developers.openai.com/api/docs/guides/function-calling), [image input](https://developers.openai.com/api/docs/guides/images-vision), and [model capabilities](https://developers.openai.com/api/docs/models/gpt-5.4-mini). Documentation informed the probe; the pass claims above come from successful API calls and assertions, not the model catalog.

## Repeating the capability check

With authorized local credentials, create a temporary server-side script using the installed SDK. Generate a synthetic PNG in memory, submit high-detail image input, and assert meaningful structured transcription. Separately offer an unforced function tool, validate the returned call, execute it, and replay the full response plus the matching output containing a value unavailable in the initial input. Assert that a tools-disabled structured response consumes that value. Record actual model identifiers, failures, and timings; remove the script and never persist image payloads or secrets. Normal application tests must remain independent of credentials and network access.

Before committing this evidence, `npm test` passed all **578 tests in 43 files**, and `npm run lint` passed. The existing trip-filter test import correction was included from the integration branch before those checks. These regression checks do not themselves make live API calls.
