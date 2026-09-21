# 05: Recover unfinished ride-draft tabs within the browser session

**What to build:** The same signed-in driver can refresh or navigate away and return to the unfinished draft set within the current browser session. Recovery keeps current form values, active tab, distance overrides and publication identities, and clearly distinguishes session saving from publishing a ride.

**Blocked by:** 02: Calculate driving km from the two filled city names; 03: Create and publish multiple ride-draft tabs.

**Status:** completed

- [x] Persist and restore the current draft set within the browser session for the same authenticated user. Preserve stable tab/submission identities, order, active tab, all editable values, warnings, manual distance overrides and known publication results.
- [x] Scope recovery to the signed-in account so switching users never exposes or restores another user's draft set. Validate stored state and handle corrupt or incompatible data explicitly instead of treating it as a valid draft.
- [x] Restore the current form values before considering distance requests. Preserve valid manual overrides for their city pair, avoid presenting old-route km as current, and reuse the city-fields-first two-string distance contract when a fresh lookup is needed.
- [x] Do not restore stale pending requests as authoritative results. Revalidate canonical city/car references, current ownership, required fields and future departure before publication. A previously valid departure can become invalid while the user is away.
- [x] Preserve a published tab's terminal result and link; refreshing must not allow that draft to produce another ride. Keep unpublished siblings editable and retryable. Retain each draft's stable submission identity across recovery.
- [x] Replace the existing server Save draft control in the tabbed flow with truthful Saved for this session status. Publish remains the explicit server-save action; do not introduce cross-device incomplete-draft storage or depend on the old complete-only server draft lifecycle.
- [x] Show session-saved status only after storage succeeds. If storage is unavailable, full or malformed, explain that recovery is unavailable without falsely reporting saved/restored success or preventing current-form editing and manual publishing.
- [x] Recover all current values whether they came from manual edits, interpretation or an already-integrated correction. This ticket does not require the correction implementation to begin; both features use the shared complete draft-state contract.
- [x] Test through the rendered tabbed form with real session-storage behavior where supported and controlled storage failures. Cover refresh/remount, navigation restoration, active tab, multiple incomplete drafts, all form fields, distance overrides, published state, user changes and corrupt/stale data.
- [x] Exercise recovery followed by successful per-tab publication and retries, proving that siblings remain and a published draft is not duplicated. Verify unavailable routing/AI does not prevent restoring or manually finishing saved session values.
- [x] Verify the complete browser flow from description through two tabs, refresh, review and publishing one tab. If ticket 04 is integrated, include correction and Undo before refresh; run the combined regression checks when both tickets are present.
- [x] Run relevant tests and required repository checks, verify accessible saving/failure messages and mobile layouts, and document the browser-session recovery boundary and actual verification results. No new server-side draft model is required.

## Completion evidence

Implemented and verified on 21 September 2026. See [combined verification](../../../docs/verification/ride-offers.md) for the 393-test suite, live AI and road-distance checks, actual database concurrency guarantees, browser flows, and resolved review findings. Changes are committed locally; nothing was pushed or pulled.
