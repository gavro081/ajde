# Location resolver handoff

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
