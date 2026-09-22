# Local AI import pipeline verification

Work started from `66c77192b305356c3ca5ed79fe52b7d12708664d` on 22 September 2026.
GitHub parent #3 and tickets #4–#10 were open, with no comments, when read. Native blockers
were #6 ← #4/#5, #7/#8 ← #6, #9 ← #7/#8, and optional #10 ← #9.
All work stays local; the user's local-only instruction overrides the source handoff's push,
direct-main-merge, and issue-closure requirements.

## Prerequisites

- [Capability evidence](ai-import-capabilities.md): actual image input and model-selected
  function-call continuation succeeded. This is a capability sample, not an accuracy evaluation.
- [Shared routing](ai-import-routing.md): existing HTTP behavior and feature-flag independence
  are covered with transport/database fakes.
- The starting tree's `trip-tabs.test.ts` imported the old `parseDriverRideFilter` name. Updating
  it to the existing `parseTripStatusFilter` restored all 578 baseline tests, lint, and typechecking.
  No application behavior changed in that baseline repair.

## Checker increment (#6)

The public checker seam covers structured-field projection, multi-round model-selected routing,
call/output matching, bounded execution, evidence relevance, missing-distance fill, preservation,
and fail-open results. Endpoint tests cover offer-only checking, authentication, strict flag
semantics, stale client enablement attempts, persistence/response metadata, and schema compatibility.
Review tests cover readable estimates/errors and explicit continuation to the editable form.
The integration test exercises the real parser, canonical guards, checker, routing adapter,
and persistence boundary using only fake external SDK/transport/database services.

Only the exact server environment value `AI_IMPORT_PIPELINE_ENABLED=true` enables the increment.
The default remains disabled; changing environment configuration requires a normal server restart.
No database migration or change to publishing validation is part of this work.

## Delivery constraints and remaining verification

The source handoff's screenshot cutoff is 14:00 Europe/Skopje, feature freeze 14:15,
verification/documentation cutoff 14:45, and read-only cutoff 15:00 on 22 September 2026.
Remote publication is excluded by the user's explicit instruction. A demo-environment publish
walkthrough is therefore not claimed. Deterministic checks do not establish live database policies,
OSRM availability, model accuracy, or provider retention guarantees.

Final integrated test/lint/build results and later slices are recorded below as they complete.

- #6 integrated: 638 tests across 49 files passed; ESLint and TypeScript (`--noEmit
  --incremental false`) passed. This run includes the parser/checker/routing/persistence integration
  and visible review actions. External services were faked; no live end-to-end import is claimed.
- A local headless Chromium check at **375 × 812** rendered the actual import component and app
  Tailwind CSS. Paste → explicit parse → readable evidence → editable-form link passed, without
  horizontal overflow. Exactly one parse request and zero publication requests occurred; disabled
  mode hid the checker summary. The harness used local fixture transport and an anchor adapter for
  Next navigation, so this does not claim login, database, or live-model coverage.

## Complete checker increment (#7 and #8)

The parallel [fair-price](ai-import-prices.md) and [similar-ride](ai-import-similar.md) slices were
merged centrally. The shared dispatcher, schemas, adapters, prompt, and summaries retain all three
tools under one call budget and feature flag. A mixed success/error payload is rejected even when
its error field is malformed. Informational duplicate findings retain the existing `ambiguous`
warning mapping.

The combined endpoint test exercises real parsing/guards/checker/adapters with fake external
services: 60 km, three offered seats, 7 L/100 km and a **test-configured** 100 MKD/L produce 420 MKD
trip cost and 140 MKD per seat; the original 1,200 MKD price is flagged and preserved. The same
response persists a possible duplicate and all evidence, and remains compatible with the editable
draft schema. The visible import flow retains all three summaries and the continuation link.

Before screenshot implementation started, **732 tests across 56 files**, ESLint, and TypeScript
passed on the integrated checker. No pump-price accuracy, live routing, database, or model quality
claim follows from these fixture values. This committed checker remains an independently usable
increment with the pipeline flag enabled.

## Screenshot increment (#9)

The [reader/endpoint checks](ai-import-screenshot-reader.md) were integrated with the selection UI.
**788 tests across 59 files**, ESLint, and TypeScript passed. The added integration test traverses
screenshot extraction → explicit selected text → existing parser/guards → checker → persisted
editable draft. Extraction performs no import insertion; unselected text and image data are absent
from the eventual saved record. Visible tests cover offer/request/other selection, transcript edits,
explicit parsing, unreadable fallback, disabled UI, oversized uploads, and pending-read behavior.

At **375 × 812**, headless Chromium rendered the actual screenshot/import components and app CSS.
Upload → choose offer → edit transcription → Create review draft → check summary → editable-form
link passed, with no horizontal overflow. Upload and selection caused no parse request; the complete
interaction issued one extraction request, one explicit parse request, and zero publication requests.
Disabled mode hid screenshot controls and checker summaries. The screenshot was visually inspected.
This used local fixture responses and a navigation anchor adapter, not live authentication or database
writes. A remote/demo publication walkthrough was intentionally not run under the local-only instruction.

Screenshot delivery was completed locally before the supplied 14:00 Europe/Skopje cutoff. The
default-off flag controls the completed reader and checker together; the earlier checker commit
`0568285` remains available independently.
