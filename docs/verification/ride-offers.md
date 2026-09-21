# Ride-offer tickets: completion and verification

All five approved local tickets are implemented. Baseline: `7ec95d2`. Initial implementation:
`43fa6e8`; subsequent local fix commit includes review corrections and this verification record.
The unrelated concurrent logo commit was excluded from this feature's review. No GitHub issues,
pull requests, pushes or pulls were made.

## Delivered behavior

Natural-language fill supports English and Macedonian Latin/Cyrillic, catalog locations and local
aliases. It creates editable explicit-trip tabs, applies clearly shared details, resolves dates in
Skopje time, and leaves missing seats/price/vehicle variants for review. Active-tab corrections
preserve omitted fields; Undo restores the full prior draft. Every tab publishes separately and
survives session recovery with a stable submission identity and terminal published result.

Every newly filled form route, including imports, sends two selected city-name strings to the
authenticated distance API. That operation resolves catalog city-centre coordinates and requests
OSRM driving kilometres. Pickups do not recalculate it. Overrides survive unrelated edits; city
changes invalidate them. Provider failure keeps km optional and editable. A shared database gate
limits requests across app instances. Publication is transactional and idempotent, and reuses the
driver's matching vehicle across sibling drafts.

## Verification on 21 September 2026

- Full suite: **393 tests across 28 files passed**; lint, TypeScript and production webpack build passed.
- Live AI evaluation: four examples passed, covering English, Macedonian Latin/Cyrillic and an
  outbound/return description with shared car/seats/price. Parser regressions inject model output
  and clock and test ambiguous/missing values, weekday boundaries, unknown IDs, landmarks,
  explicit vehicle information and incomplete corrections.
- Full PostgreSQL `schema_smoke.sql` passed, including new rollback-only publication, retry,
  ownership, capacity, non-finite values and atomic failure cases. Both reviewed migrations are
  applied to the configured development database; generated types reflect that schema.
- Real simultaneous authenticated requests: repeated submission produced one ride, a distinct
  submission produced another ride, shared vehicle details reused one car, edited vehicle details
  remained independent, and six concurrent routing permits granted exactly one call.
- Playwright browser at 390px and 1440px, device timezone America/Los_Angeles: two-tab fill,
  Skopje display/submission, live city-first routing (**174.3 km** Skopje–Bitola), manual override,
  correction/Undo, refresh, stable sibling drafts, keyboard navigation, separate publication and
  terminal published recovery passed. No browser runtime errors or horizontal overflow.
- Browser import regression: one imported draft published with its original import identity while
  routing failed; kilometres remained blank and optional. A recovered native sibling was then
  manually completed and published. Test account, imports, cars and rides were cleaned up.
- Existing search/import, fuel-estimate, booking, sharing, completion, communication, ratings and
  impact tests passed in the combined suite.

## Standards

The independent standards review found no documented-standard breaches or actionable heuristic
code smells. It found two correctness issues: non-finite values accepted by the new RPC and a
device-time help message inconsistent with Skopje conversion. Both were fixed and re-reviewed.
Direct PostgreSQL tests cover the special-value bypasses.

Standards: **0 outstanding findings**; two initial P2 correctness findings resolved.

## Spec

The independent spec review found four P2 issues: discarded explicit fuel/consumption, incorrect
timezone guidance, combined city/landmark resolution, and rejected qualified natural-language
times. All were fixed with regressions. Follow-up review caught a period-only time regression;
“morning,” “afternoon,” and “попладне” without an hour now remain unresolved. An additional
import-distance regression ensures imported/model kilometres cannot masquerade as a manual override.

Spec: **0 outstanding findings**; four initial P2 findings and the follow-up regression resolved.

## Operational boundary

Public OSRM remains a limited non-commercial demo dependency with manual fallback. Session
recovery is browser-session and account scoped, not cross-device draft storage. Live provider
evaluations are opt-in; normal tests mock external services. No hosting deployment was performed.
