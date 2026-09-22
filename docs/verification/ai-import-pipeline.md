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
