# Screenshot reader and upload endpoint

Ticket [#9](https://github.com/AI-Tech-Summit-Filip-Avramchev/lightweight-repo/issues/9) adds a separate screenshot-reading job ahead of post selection, parsing, and the completed tool-backed checker. This record covers the reader and endpoint; the integrated UI and viewport checks are recorded with the full feature.

## Public boundaries

[readScreenshot](../../ride-share-app/lib/ai/read-screenshot.ts) accepts `{ bytes: Uint8Array, mimeType: string }` and an optional injected `modelRunner`. It returns `{ posts: [{ text, kind, confidence }] }`. The browser-safe [screenshot contract](../../ride-share-app/lib/ai/screenshot-contract.ts) exports schemas, post types, allowed MIME types, and the 4 MiB byte limit. The exact acceptance boundary is **4 × 1024 × 1024 decoded image bytes**, excluding data-URL/base64 overhead. Empty input and MIME types other than PNG, JPEG, and WebP are rejected before any model call. This metadata validation does not itself decode or prove the validity of an image payload.

The server creates a data URL only in memory and sends it with high image detail using the existing OpenAI Responses SDK. It selects a nonempty, trimmed `OPENAI_MODEL` or the verified `gpt-5.4-mini` fallback; no separate vision model is introduced. Requests use `store: false`, a 15,000 ms timeout, and zero retries. [The earlier live capability check](ai-import-capabilities.md) establishes the fallback's image capability; these implementation tests do not claim another successful live model run.

The structured response contains `legible` and posts whose text is at most 5,000 characters, kind is `offer`, `request`, or `other`, and confidence is between zero and one. The prompt requests original scripts, language, emoji, spacing, and typos without correction or translation, separate messages, no UI chrome, and `[?]` for unreadable fragments. Image text is data, not instructions. Code preserves returned characters exactly, removes whitespace-only posts, and retains the first ten remaining posts of all kinds. A model cannot be guaranteed to transcribe perfectly; the editable human checkpoint remains necessary.

Illegible or empty output raises the typed message **“Couldn't read this screenshot, paste the text instead”**. Invalid structured output and unexpected provider failures become safe typed provider errors; credentials, provider response bodies, and image data are not logged or included in errors.

## HTTP and retention behavior

[POST /api/parse/screenshot](../../ride-share-app/app/api/parse/screenshot/route.ts) checks `AI_IMPORT_PIPELINE_ENABLED` before authentication, body parsing, or image processing. Disabled requests return **404**, including stale enabled clients. Enabled requests require a signed-in user (**401** otherwise), then exactly one multipart file named `image`. Remote URL strings, multiple files, extra fields, malformed multipart bodies, unsupported MIME, zero bytes, and oversized uploads return **400**. File MIME and size are checked before `arrayBuffer`; the public reader repeats its own validation before the model.

Successful responses contain posts only and use `Cache-Control: no-store`. Missing credentials map to **503**, model refusal and unreadable output to **422**, and provider failures to **502**. Extraction does not call the ride parser, insert an import, upload to object storage, or write screenshot/transcript files or logs. Only a later explicit “Create review draft” submits the selected, possibly edited text to the established parsing/persistence path. This describes application retention; `store: false` is a request setting, not an independently verified guarantee about all provider retention.

## Verification scope

The deterministic public-reader and HTTP tests exercise all MIME types at the exact size limit, invalid and oversized input before AI processing, verbatim character preservation, output limits, whitespace filtering, ten-post retention, all selectable kinds, typed errors, model configuration, high-detail input, refusal handling, zero retries, disabled-before-body/auth behavior, authentication, multipart validation, HTTP mapping, and absence of parsing/database/object-storage calls. SDK transport tests use fake responses and make no live API requests. There is no new measured production reader latency or accuracy claim in this record; the bounded timeout applies per request.

Before the reader/endpoint commit, **780 tests passed in 58 files**, including 48 new reader/endpoint tests. `npm run lint` and `npx tsc --noEmit` passed (after `next typegen`). This work remained local; no repository changes were pushed or published.
