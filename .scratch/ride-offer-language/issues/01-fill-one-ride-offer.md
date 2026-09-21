# 01: Fill and publish one ride offer from a description

**What to build:** A driver enters a description such as “going skp to bt 4pm saturday with a clio”, clicks Fill form, reviews the known details in the existing offer form, completes missing values and explicitly publishes one ride. Deliver the input, authenticated interpretation, editable form application, validation and verification together.

**Blocked by:** None (can start immediately).

**Status:** completed

- [x] Before adding fill behavior, make the smallest necessary form-state refactor so every existing editable field can be populated and subsequently edited reliably. Preserve manual and imported creation and the existing publication behavior; include these regressions in this ticket rather than creating a separate horizontal refactor ticket.
- [x] Add a labelled ride-description input and explicit Fill form action above the offer form. Use a server-side interpretation boundary with validated structured output and authoritative location, catalog-model and current-user saved-car candidates. Keep provider credentials server-side.
- [x] Support English and Macedonian in Latin and Cyrillic, including consistent skp/Skopje and bt/Bitola matching. Resolve only existing catalog cities and pickup points. Unknown places and invalid or fabricated IDs remain unresolved with field-specific warnings.
- [x] Fill the supported fields actually supplied by the description, including route/landmarks, departure, car information, offered seats, MKD price, notes, tags and existing passenger preferences where their meaning is supported. Do not invent missing data or expand preference semantics.
- [x] Interpret, display, edit and submit departure in Europe/Skopje regardless of device timezone. Recognize 4pm as 16:00. A bare weekday with time means its next future occurrence, including today if still ahead; explicit past dates are invalid and ambiguous times such as at 4 need attention.
- [x] Correct the existing bare-4pm rejection and ISO-to-device-local mismatch wherever reused. With a fixed Monday 21 September 2026 reference, the sample means Saturday 26 September at 16:00 Skopje time.
- [x] For an underspecified Clio, select a saved car only if exactly one of this driver's saved cars matches. Otherwise preserve known make/model information and require variant selection; do not guess fuel or consumption from the model family.
- [x] Leave omitted available seats and price blank. Do not infer offered seats from car capacity. Retain separate explicit acceptance of the existing calculated price suggestion.
- [x] Applying a successful first fill creates an editable unpublished draft; publishing remains an explicit separate action with the existing server validation and car-ownership checks. Native descriptions must not create imported-post records.
- [x] Show pending, failure and unresolved-field states accessibly. Failed interpretation preserves the entered text and all existing manual form values and offers Retry. Manual completion remains possible when AI is unavailable.
- [x] This initial slice delivers one trip. Do not silently discard additional trips or invent recurring rides; until ticket 03 supplies multiple tabs, return clear unsupported-multiple-trip feedback without applying a truncated description.
- [x] Exercise the rendered form using existing component-test tools and the interpretation operation through its public boundary, injecting model output and the clock. Cover languages/aliases, canonical-ID rejection, missing fields, car ambiguity, date/time boundaries, device timezone differences, provider failure, editable results and explicit successful publication.
- [x] Verify keyboard and mobile use plus manual/import/search regressions. Run relevant tests and required repository checks, record results and limitations, and document the delivered single-trip behavior. No road-routing integration is required here; ticket 02 is independent.

## Completion evidence

Implemented and verified on 21 September 2026. See [combined verification](../../../docs/verification/ride-offers.md) for the 393-test suite, live AI and road-distance checks, actual database concurrency guarantees, browser flows, and resolved review findings. Changes are committed locally; nothing was pushed or pulled.
