# 03: Create and publish multiple ride-draft tabs

**What to build:** A multi-trip description creates one independently editable tab for every recognized explicit trip. The driver can switch, add or discard drafts and publish each ride separately without leaving the draft set or losing sibling work.

**Blocked by:** 01: Fill and publish one ride offer from a description.

**Status:** completed

- [x] Extend the creation interpretation and form experience from ticket 01 to return and render every explicit trip, including outbound/return journeys. Do not silently drop trips or truncate a successful result. Recurring schedules remain unsupported with useful feedback.
- [x] For “Skopje to Bitola Saturday 4pm, back Sunday 6pm, Clio, 3 seats, 400 den”, create two tabs with opposite city routes, separate departure times and the clearly shared vehicle, three offered seats and 400 MKD price. Missing or ambiguous per-trip details remain unresolved.
- [x] Apply shared details only to the trips the wording supports. Each draft retains its own route, departure, car selection, notes, preferences, warnings and editable values. Do not carry incompatible pickup or vehicle fields between trips.
- [x] Give every tab a stable local draft identity and distinct stable submission identity. Preserve all fields while switching tabs, including previously uncontrolled fields. Tab labels identify route/date and have useful incomplete-draft alternatives.
- [x] Initial Fill form can create the draft set. Add Create more drafts to append trips without replacing existing work. Provide a way to discard an unwanted unpublished draft without affecting siblings. Interpretation failures preserve the entire current set and description.
- [x] Publish only the selected tab with authoritative server-side validation. After success, keep the page on the tab set, mark that tab published and show View ride. Other drafts remain editable and are not silently submitted, reset or navigated away from.
- [x] Keep failed publication local to the selected draft and retryable. Prevent a retry, repeated click or restored successful submission from creating another ride for that draft. Distinct tab identities must create distinct rides rather than returning the first tab's saved ride.
- [x] When sibling drafts describe the same actual vehicle, reuse the owned vehicle across their publications. Do not duplicate saved-car records solely because two trips were created. A different edited vehicle must remain independent.
- [x] Preserve existing source/import ownership rules. Native multi-trip descriptions create native rides, while the existing external-post import remains a single imported draft. Do not change import classification or create multiple import records.
- [x] Ensure pending form operations and any already-integrated distance responses are associated with stable draft identity rather than tab position. Existing manual distance editing remains available; ticket 02's routing is reused when integrated but is not a prerequisite for this slice.
- [x] Use accessible keyboard tab navigation, scoped field labels/IDs, clear focus and mobile layouts. Published tabs cannot be re-published or silently turned back into editable new offers.
- [x] Cover the complete rendered two-trip flow, shared versus individual details, incomplete trips, tab switching, add/remove, failure retention and publishing either tab first. Assert separate submission identities, one persisted ride per draft, sibling preservation and shared-car reuse.
- [x] Verify persistence/retry and concurrent duplicate behavior at the actual database boundary where a database guarantee is involved. Include narrowly necessary schema work, database documentation and generated types together; do not expand into unrelated database hardening.
- [x] Run the relevant suite and required repository checks, verify keyboard/mobile behavior and single-trip/import regressions, and document the multi-tab workflow and any verification limitations. Corrections and session recovery follow in tickets 04 and 05.

## Completion evidence

Implemented and verified on 21 September 2026. See [combined verification](../../../docs/verification/ride-offers.md) for the 393-test suite, live AI and road-distance checks, actual database concurrency guarantees, browser flows, and resolved review findings. Changes are committed locally; nothing was pushed or pulled.
