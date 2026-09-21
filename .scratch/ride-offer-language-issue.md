# Natural-language ride offers with multiple draft tabs and road-distance fill

## Problem Statement

Drivers currently enter offered rides field by field or import a previously written external post. They need to describe their own trip in ordinary language and fill the offer form, including road distance. A description can contain several explicit trips, and each trip needs its own reviewable form without losing the other drafts when one is published.

## Solution

Place a ride-description input above the offer form with an explicit **Fill form** action. Interpret English and Macedonian in Latin or Cyrillic, including local abbreviations such as `skp` and `bt`. Produce one editable ride-draft tab per recognized explicit trip, including return journeys. Fill information supplied by the description, apply clearly shared details to the relevant trips, and leave unknown information for the driver.

The driver reviews and publishes each tab separately. A successful publication leaves the tab set open, marks that tab published, and offers **View ride**. Other drafts retain their values and remain editable. Recover drafts within the current browser session for the same signed-in user. Replace the existing **Save draft** button in this flow with truthful session-recovery status; **Publish** is the explicit action that stores a ride on the server.

Fill the city fields first. Once both contain valid distinct selections, send their two city-name strings to the application's distance API. The server resolves those catalog names to coordinates for OSRM, then returns kilometres to the form. This is shared form behavior, independent of how the cities were entered.

## User Stories

1. As a driver, I want to describe my trip and explicitly click Fill form, so that I can prepare an offer without entering every field manually.
2. As a driver, I want to use English or Macedonian in Latin or Cyrillic, so that I can write naturally.
3. As a driver, I want to use local abbreviations such as skp and bt, so that I can describe familiar cities briefly.
4. As a driver, I want to have locations matched to the current city and pickup-point catalog, so that I can offer a route passengers can find.
5. As a driver, I want to see unresolved locations marked for manual selection, so that I can avoid publishing an invented route.
6. As a driver, I want to have all supported details that I state filled into the form, so that I can review them in familiar controls.
7. As a driver, I want to see missing details left for me to complete, so that I can avoid accepting invented information.
8. As a driver, I want to review and edit the filled draft before publishing, so that I can control the final offer.
9. As a driver, I want to have 4pm understood as 16:00, so that I can use familiar time notation.
10. As a driver, I want to see the resolved departure date and Skopje local time, so that I can know exactly when the trip departs.
11. As a driver, I want to have a weekday mean its next future occurrence at the stated time, so that I can use relative dates predictably.
12. As a driver, I want to use today's weekday when the stated time has not passed, so that I can offer a ride later today.
13. As a driver, I want to see an explicit past date rejected rather than silently moved, so that I can correct the actual date mistake.
14. As a driver, I want to see ambiguous times such as at 4 flagged, so that I can avoid an unintended morning or afternoon departure.
15. As a driver using another device timezone, I want to retain the intended Skopje departure during filling, editing and publishing, so that I can avoid a shifted ride time.
16. As a driver, I want to have a saved car selected only when exactly one matches my description, so that I can reuse my vehicle without an arbitrary choice.
17. As a driver, I want to choose the variant when Clio matches several possibilities, so that I can avoid incorrect fuel and consumption details.
18. As a driver, I want to retain recognized make and model while resolving the variant, so that I can avoid re-entering known information.
19. As a driver, I want to enter available seats when I omit them, so that I can avoid advertising the full car capacity by assumption.
20. As a driver, I want to enter price when I omit it, so that I can choose the fare passengers will pay.
21. As a driver, I want to accept the calculated price suggestion separately, so that I can control whether it becomes my offered price.
22. As a driver, I want to receive one editable tab per explicit trip, so that I can prepare several offers together.
23. As a driver, I want to receive separate outbound and return drafts, so that I can keep both journeys.
24. As a driver, I want to have clearly shared details applied to relevant trips, so that I can avoid repeating common information.
25. As a driver, I want to keep trip-specific route and departure values separate, so that I can avoid mixing details between offers.
26. As a driver, I want to see missing return-trip details left unresolved, so that I can complete them without relying on guesses.
27. As a driver, I want to receive guidance to describe explicit trips when I enter a recurring schedule, so that I can understand this version's scope.
28. As a driver, I want to recognize tabs by route and date with labels for incomplete drafts, so that I can find the offer I want to edit.
29. As a driver, I want to switch tabs without losing edits, so that I can review trips in any order.
30. As a driver, I want to append more trips with Create more drafts, so that I can preserve existing work.
31. As a driver, I want to apply a correction only to the active draft, so that I can change one trip independently.
32. As a driver, I want to replace mentioned values while preserving omitted ones, so that I can make concise corrections.
33. As a driver, I want to have an ambiguous mentioned replacement cleared and flagged, so that I can avoid leaving an old value that appears confirmed.
34. As a driver, I want to have incompatible dependent fields cleared when a city or car changes, so that I can avoid contradictory form data.
35. As a driver, I want to undo a fill or correction including dependent distance values, so that I can restore the previous draft.
36. As a driver, I want to discard an unwanted unpublished draft independently, so that I can remove a mistaken trip without losing its siblings.
37. As a driver, I want to see both cities filled in the form before distance is requested, so that I can know which route the calculation describes.
38. As a driver, I want to have the two filled city-name strings sent to the distance API, so that I can receive kilometres for the route currently in the form.
39. As a driver, I want to receive distance from a road-routing service, so that I can avoid straight-line or model-invented kilometres.
40. As a driver, I want to get automatic km for manual, natural-language and imported routes, so that I can use the same calculation in every entry path.
41. As a driver, I want to keep distance city-to-city even when pickup points are selected, so that I can use a consistent city-based estimate.
42. As a driver, I want to override calculated km, so that I can account for the route I plan to drive.
43. As a driver, I want to retain my override through unrelated and pickup-point edits, so that I can avoid losing an intentional value.
44. As a driver, I want to recalculate distance when either city changes, so that I can avoid kilometres from an old route.
45. As a driver, I want to enter km manually when routing fails, so that I can finish my offer without the service.
46. As a driver, I want to publish without distance when all required fields are complete, so that I can retain the existing optional-distance behavior.
47. As a driver, I want to see updated estimates without an automatic price change, so that I can keep control of the published fare.
48. As a driver, I want to retain text and draft edits when parsing fails, so that I can retry or finish manually.
49. As a driver, I want to keep valid extracted fields when other values need attention, so that I can complete only what is missing.
50. As a driver, I want to avoid late responses overwriting newer edits or Undo, so that I can trust the displayed draft.
51. As a driver, I want to recover unfinished tabs after refresh or navigation in this browser session, so that I can avoid losing work.
52. As a driver, I want to recover drafts only for my signed-in account, so that I can avoid seeing another user's draft details.
53. As a driver, I want to see Saved for this session only when storage succeeds, so that I can understand whether recovery is available.
54. As a driver, I want to continue editing when browser storage is unavailable, so that I can finish the offer despite storage problems.
55. As a driver, I want to use Publish as the explicit server-save action, so that I can distinguish a session draft from a created ride.
56. As a driver, I want to publish each draft separately, so that I can review every offer independently.
57. As a driver, I want to see a published status and View ride without leaving the tabs, so that I can continue preparing other offers.
58. As a driver, I want to retain sibling drafts when one publication fails, so that I can retry only the affected offer.
59. As a driver, I want to retry publication without creating another copy of the same ride, so that I can avoid duplicate offers.
60. As a driver, I want to publish different tabs as distinct rides, so that I can avoid one trip replacing another.
61. As a driver, I want to reuse the shared vehicle across sibling trips, so that I can avoid duplicate saved-car records.
62. As a driver, I want to have recovered and submitted values revalidated against current data, so that I can avoid publishing stale or invalid details.
63. As a keyboard user, I want to navigate tabs and use fill, Undo and Publish with clear feedback, so that I can complete the workflow without a mouse.
64. As a mobile user, I want to review multiple draft forms at a narrow screen width, so that I can offer rides from my phone.
65. As a driver, I want to continue using existing search, manual creation and external-post import, so that I can keep the current journeys alongside the new feature.
66. As a maintainer, I want to limit and identify routing requests across the application, so that I can respect the free service's usage conditions.
67. As a maintainer, I want to verify the complete workflow through existing test tools, so that I can detect regressions without coupling tests to internals.

## Implementation Decisions

### Description interpretation

- Support the current city and pickup-point catalog, canonical-ID validation, English, Macedonian Cyrillic and Latin transliteration, and explicit local aliases including `skp` for Skopje and `bt` for Bitola. Unknown places remain unresolved and require manual selection; do not invent catalog entries or IDs.
- Extract supported form information that is actually present: route and supported landmarks, departure, offered seats, car details, MKD price, notes, tags and passenger preference where their meaning matches existing controls. Do not invent unavailable information or broaden existing preference semantics.
- Interpret all dates and times in `Europe/Skopje`, independently of the device timezone. Show the resolved calendar date and time. Recognize `4pm` as 16:00.
- A weekday with an explicit time means its next future occurrence, including today if that time has not passed. Explicit past dates are invalid and must not silently move to another date. Missing or ambiguous times require attention; `at 4` alone is not enough to choose 04:00 or 16:00.
- For an underspecified car such as `Clio`, select a saved car only when exactly one of the current driver's cars matches. Otherwise preserve recognized make/model information and require variant selection. Do not infer a fuel type or consumption value from an ambiguous model family.
- Leave omitted available seats and price for the driver. Car passenger capacity is not the number of offered seats. Keep the existing calculated price suggestion as a separate **Use suggestion** action once its inputs are available.
- Recognize every explicit trip in the accepted description. Do not discard the return journey or silently truncate trips. Shared details apply only to the trips the text supports; individual route and departure values stay separate. A return trip can reverse the known cities, but missing return-time details remain unresolved.
- Recurring schedules such as `every weekday next month` are outside scope. Explain that explicit trips are needed rather than silently generating an arbitrary schedule.
- Native ride descriptions remain native ride offers. Reuse parsing and canonicalization where useful, but do not call the import endpoint in a way that creates an external-post import record for the driver's own description.

### Editing and multiple tabs

- Each recognized trip has its own stable tab identity, editable form state, warnings, route-distance state and submission identity. Switching tabs preserves all edits. Use clear route/date labels with sensible labels for incomplete drafts and accessible keyboard tab navigation.
- Fill operations never publish automatically. The initial description can create several drafts; a separate **Create more drafts** action appends additional drafts. Later corrections target only the active unpublished tab.
- Applying a correction replaces explicitly mentioned fields and preserves omitted fields. Show what needs attention. If a mentioned replacement is ambiguous or unresolved, clear its affected value and flag it instead of retaining a misleading old value.
- Preserve related-field validity: changing a city clears an incompatible pickup point; changing the car must not retain incompatible fuel or consumption details. Omitted unrelated fields remain unchanged.
- Offer Undo for applied fill/correction changes, restoring the previous draft and dependent values, including distance and whether it was manually overridden. Associate each parser/routing response with the originating draft and input revision. A tab switch must not redirect a response into another draft; late results must not overwrite newer edits, an Undo, or a published tab.
- Keep each tab's publish operation independent. Validate the same required ride fields on the server, publish only the selected draft, and keep sibling tabs intact on success or failure. No bulk publish action.
- Retries must not create a second ride for the same draft. Different tabs must not share a submission identity. Reuse the same owned vehicle where sibling drafts describe the same vehicle, rather than creating duplicate saved-car records merely because two trips were published.
- Allow unwanted unpublished drafts to be discarded without changing sibling rides. Published tabs cannot be re-published through fill or Undo.

### Driving distance

- Use public OSRM driving routing for the current low-volume, non-commercial hackathon demo. This replaces the initially considered fixed city-distance table. It calculates a road route; the LLM must not invent kilometres.
- Always route between the canonical origin and destination city reference coordinates. Do not use selected pickup/drop-off coordinates. Changing a pickup point alone does not recalculate distance. This is an estimated city-to-city driving distance, not an exact pickup-to-drop-off distance.
- Apply automatic distance in the shared offer form for natural-language, manual and imported routes. First fill or update both city fields in the form; only once both contain valid, distinct catalog cities should the form call the application's distance API with those two city-name strings. Use the values currently in the form, not raw description text or uncommitted model output. Missing or unresolved cities do not trigger routing.
- The application's distance API accepts the origin and destination city names as two strings, validates and resolves them against the existing catalog, and obtains the canonical city reference coordinates. It calls OSRM with those coordinates because OSRM does not accept city names directly, then returns a numeric distance in kilometres or a distinguishable failure. Convert provider metres to kilometres and label the form value as an estimated driving distance. No external geocoding or model-invented coordinates are needed.
- Drivers can override km. Preserve their override until a city changes. Changing either city invalidates the old distance and starts a new lookup with visible feedback; never use stale km from the previous city pair if the new lookup fails.
- Keep direction in route identity; do not assume opposite-direction routes have identical distance. Multiple draft tabs must respect the service-wide limit of one request per second rather than issuing an unrestricted burst.
- Call routing server-side using a descriptive application User-Agent. Respect the public service's usage policy and required routing/OpenStreetMap attribution and fix-the-map link. Bound requests with a timeout and handle unavailable routes and invalid responses explicitly.
- If distance lookup fails, retain other successfully filled fields, explain the unavailable estimate, and permit manual km. Distance stays optional for publishing. Do not replace failure with a guessed or straight-line value.
- Keep the existing transparent fuel-price and CO2 arithmetic. A refreshed distance updates estimates but does not silently overwrite the driver's chosen seat price.

### Session recovery and failures

- Restore unfinished tabs and their edits after refresh or navigation within the current browser session, scoped to the same signed-in user. Preserve tab identity, active tab, warnings, manual distance overrides and submission state needed to avoid duplicate publishing.
- Keep recovered data separate between users. Validate recovered state and revalidate ride eligibility, future departure and catalog references before publication. Storage problems must not produce a false **Saved for this session** status; the current form remains usable and explains recovery is unavailable.
- The tabbed flow uses session recovery and **Publish**, without introducing cross-device incomplete-draft storage or extending the existing server draft lifecycle.
- If AI interpretation fails, preserve the entire existing form/tab set and offer Retry. If interpretation succeeds partially, retain useful fields and clearly mark unresolved ones. A failed request must not erase typed descriptions or manual edits.
- Provide distinct pending, completed, warning and failure feedback for interpretation, routing, recovery and publishing. Keep manual editing usable when external services are unavailable.

### Shared boundaries and existing constraints

- Use authenticated server-side interpretation with structured, validated output and authoritative catalog/owned-car candidates. Distinguish creation from active-draft correction, and omitted fields from explicitly mentioned unresolved replacements. Keep provider credentials server-side.
- Current `RideDraft`, native/imported provenance, canonical-location resolution, car catalog and validation provide reusable building blocks. The import endpoint has persistence side effects and currently returns one draft; preserve its existing post-import contract.
- The import parser's explicit-time guard currently rejects bare `4pm`. The current form slices ISO timestamps into device-local inputs. Both are verified obstacles to the agreed parsing/time behavior and must be handled wherever reused.
- Existing form inputs mix controlled state and `defaultValue`/`defaultChecked`. Tab switching, repeated fills and recovery must preserve every editable field, not only those already held in React state.
- Both current submission intents navigate away on success. Current server **Save draft** requires complete publishable data, and resubmitting a saved submission ID does not publish that stored draft. Session recovery avoids extending that lifecycle in this feature.
- Current catalog/manual car creation inserts a saved car on every successful submission. Multi-trip publication needs vehicle reuse for shared cars and distinct, retry-safe ride identities.
- Read applicable repository instructions and installed Next.js guides before implementation. Any schema changes must update the maintained database-model document and generated Supabase types.
- Public OSRM is a demo dependency with no uptime or latency guarantee. Do not describe this choice as an unrestricted production service. Keep the provider replaceable and the manual fallback usable.

## Testing Decisions

- **Primary boundary:** test the complete rendered tabbed offer form through its public controls with the existing Vitest, Testing Library and jsdom tools. Keep actual form state, correction application, tab switching, Undo and recovery together, replacing external interpretation, routing and publication boundaries. Prefer this feature-level boundary to tests for every helper, hook or reducer.
- **Observable outcomes:** assert displayed values, warnings, tab isolation, submitted data and persisted results. Avoid private state, exact prompt wording, incidental markup or CSS, exact SQL and query-builder call order. Test a behavior at the highest boundary that can establish it without duplicating the scenario at every layer.
- **Prior art:** reuse ride-room component tests for user interaction, keyboard controls, retained failed input and late asynchronous results; rating and ride-completion action tests for authentication, persistence, duplicates and failures; search-parser tests for injected clock/model runners; and import, location, ride-submission, car-selection and estimate tests for their public contracts.
- **Focused server checks:** exercise description interpretation and the city-name distance API at their request/response boundaries, and publication through its server action. Replace external model/OSRM transport, authentication/database and framework cache boundaries as needed. Retain real validation and orchestration. Cover invalid catalogs, forged saved-car ownership, malformed output, provider failure and failed writes.
- **Language and time:** cover the concrete examples below, English and both Macedonian scripts, local aliases, unknown places, ambiguous cars, 4pm, ambiguous at 4, missing date/time, weekday before/at/after the specified time, explicit past dates, and a device timezone different from Skopje. Distinguish first descriptions with missing components from corrections that preserve omitted components.
- **Tabs and corrections:** cover outbound/return and other explicit trips, shared versus trip-specific fields, stable identities, switching, adding and discarding drafts, active-tab-only changes, unresolved replacements, dependent field clearing, Undo and stale responses. A tab switch must never send a response into another draft.
- **Distance sequence:** verify no API call before both city fields are filled with valid distinct selections. Assert the application request carries the two current city-name strings, the server resolves canonical city coordinates, OSRM metres become km and the correct draft receives the result. Cover all three entry paths, reverse routes, pickup edits, city changes, override preservation/invalidation, timeout, no route, invalid values and out-of-order responses. Check the combined provider request rate across concurrent tabs.
- **Recovery and publication:** cover refresh/navigation restoration, the active tab, manual overrides, user separation, corrupt/stale stored values and truthful storage failures. Publish one tab while retaining the others; preserve failure isolation, prevent retry duplicates, keep distinct drafts distinct and reuse shared cars. Recovered published state must not permit a duplicate ride.
- **Persistence evidence:** where duplicate/race guarantees rely on database behavior, exercise actual persisted concurrent submissions; mocked unique violations alone do not establish the guarantee. Record any unavailable integration environment as a limitation.
- **Browser check:** verify the main one-trip and multi-trip flows, keyboard/focus behavior, mobile layout, Undo, refresh recovery, city-first distance calculation, manual completion during provider failure and publishing without leaving sibling tabs. Use available browser tooling and record steps that do not depend on an untracked helper; do not add a generic new testing framework.
- **Live and regression checks:** regular tests mock providers and consume no model credits. Make a small live routing smoke check and record its date and observed result without treating kilometre values as permanently fixed. Recheck search/import, manual creation, car selection and price/CO2 behavior. For implementation, run the required mocked suite, lint, type check and documented Webpack production build, reporting any unavailable checks honestly.

## Out of Scope

Recurring rides; arbitrary new towns or geocoding; pickup-specific routing; route maps and alternatives; exact traffic-aware travel predictions; automatic seat/price guesses; automatic publishing or bulk publishing; cross-device incomplete-draft storage; repairing the previous server draft lifecycle; changes to the search UI or external-post import classification; booking, chat or rating changes.

GitHub publication is excluded by the user's explicit instruction. This task prepares local documentation and implementation tickets; it does not implement the application, commit changes or publish tracker issues.

## Further Notes

### Concrete acceptance scenarios

1. With a reference date of Monday 21 September 2026 in Skopje, `going skp to bt 4pm saturday with a clio` creates a Skopje-to-Bitola draft for Saturday 26 September at 16:00 Skopje time. Seats and price remain blank; a single matching saved Clio is selected, otherwise the driver chooses a variant. Distance comes from routing.
2. `Skopje to Bitola Saturday 4pm, back Sunday 6pm, Clio, 3 seats, 400 den` creates two tabs with opposite city routes, separate departure times, and the shared car description, three offered seats and 400 MKD price. Each gets its own driving-distance lookup.
3. With the second tab active, `actually Sunday at 5pm` changes only that tab. The other tab and unrelated fields are unchanged. Undo restores the affected draft.
4. `Actually at 4` clears the affected departure-time value and flags ambiguity. A correction mentioning only a new date can preserve a previously known time; a first description with no time leaves it unresolved.
5. Overriding km persists through other edits and pickup changes. Changing a city removes the old route's km and starts another lookup. A failed lookup leaves manual entry available; Undo restores the earlier route and distance.
6. Publishing one tab leaves all other drafts in place. Refresh restores remaining drafts for the same user without permitting the published draft to create a duplicate ride.
7. A provider failure preserves entered data, and the driver can finish and publish manually using the existing required fields.

### Domain and research

- Use the local domain glossary and the accepted city-to-city distance decision. Changing pickup points does not change the automatic city-based estimate; the stored distance also feeds price and completed-ride CO2 estimates.
- The latest clarification requires distance calculation after the two cities have been filled in the form, using their two city-name strings in the application API request. OSRM itself accepts coordinates, so the application resolves catalog names before calling it. See the [OSRM API contract](https://project-osrm.org/docs/v26.4.0/http).
- A live unauthenticated OSRM check on 21 September 2026 using the repository's Skopje and Bitola reference coordinates returned 174255.6 metres, approximately 174.3 km. This verifies feasibility, not a fixed future distance, every route, or service reliability.
- Public OSRM is the selected low-volume, non-commercial demo dependency. Respect the [operator policy](https://routing.openstreetmap.de/about.html), [demo policy](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server), and [OpenStreetMap attribution requirements](https://www.openstreetmap.org/copyright). No uptime or latency guarantee is assumed.
- The feature scope comes from the completed design interview and subsequent user corrections. The testing approach retains the existing component/action tools and a small browser smoke check; no implementation tests were run for this documentation task.
- Keep the specification and tickets local. No GitHub issue or label change is authorized.
# Current scope amendment

The user subsequently removed natural-language corrections. After initial AI drafting, drivers
edit the form fields directly. The “Correct this ride” input and correction API mode are removed.
Initial-fill Undo and creating additional drafts remain available. This supersedes correction
requirements in the original specification above. Successful publication also closes its tab;
after the final draft publishes, redirect to My trips (`/dashboard/trips`) and clear session drafts.
