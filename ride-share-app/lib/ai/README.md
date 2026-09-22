# Location resolver handoff

## Import plausibility checking

[`checkRideDraft`](check-ride-draft.ts) checks structured imported ride offers through injectable
model and tool boundaries. [`ride-check-contract.ts`](ride-check-contract.ts) is the browser-safe
metadata contract; [`ride-check-tools.ts`](ride-check-tools.ts) binds authenticated services.
The server-only [`import-pipeline-config.ts`](import-pipeline-config.ts) disables the pipeline unless
`AI_IMPORT_PIPELINE_ENABLED=true`. Model-selected tools cover road distance, deterministic
[`fair-price arithmetic`](fair-price-tool.ts), and [`possible duplicate rides`](similar-rides-tool.ts).
The checker never receives source text or notes, never publishes, and fails open with a review
warning. See the root README for loop limits, evidence guards, configuration, and capability evidence.

## Location normalization

Use `resolveCanonicalLocation(raw)` from `location-candidates.ts` in server-side parse/import code.
It loads the canonical city and pickup-point vocabulary from Supabase, tries deterministic names and
aliases first, and calls the server-only OpenAI fallback only for a genuine miss when
`OPENAI_API_KEY` is configured.

For injected candidates or unit tests, use `resolveLocation(raw, candidates, fallback?)` from
`resolve-location.ts`. Its stable return type is `LocationResolution`:

- resolved: `{ kind, id, displayName, confidence, resolution: "alias" | "model" }`
- unresolved: `{ kind: null, id: null, displayName, confidence: 0, resolution: "unresolved" }`

Verified deterministic cases:

| Input | Canonical result |
| --- | --- |
| `Штип` | city: Штип |
| `Stip` | city: Штип |
| `кај Мавровка` | pickup point: Мавровка |
| `од Рамстор` | pickup point: Рамстор Мол |
| `на Автокоманда` | pickup point: Автокоманда |
| `кај главна станица` | pickup point: Транспортен центар |

Unknown input must remain unresolved unless the fallback returns an ID and kind that exist in the
supplied candidate vocabulary. Never persist a model-proposed label or ID directly.

## Ride-post parser integration

`parseRidePost` now calls `resolveParsedLocations` with the candidates already loaded by
`/api/parse`. It resolves the model-preserved `rawText` for origin and destination through this
contract, derives a pickup point's city from canonical data, and clears model-proposed IDs when the
raw place remains unresolved. The API route supplies `createOpenAILocationFallback()` so exact names
and aliases make no additional model call while genuine misses may use the structured fallback.
