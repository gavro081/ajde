# 04: Correct the active ride draft and undo the change

**What to build:** With several ride drafts open, the driver can make a short correction to the active draft, retain omitted information, resolve ambiguous replacements visibly and undo the entire applied change, including its route-distance effects.

**Blocked by:** 02: Calculate driving km from the two filled city names; 03: Create and publish multiple ride-draft tabs.

**Status:** superseded in part by user request

The user removed AI corrections after implementation. Drivers now edit the drafted form directly;
the correction input and API mode have been removed. Initial-fill Undo remains available. The
original checklist below records the earlier implementation, not the current correction scope.

- [x] Provide active-unpublished-draft correction intent separate from Create more drafts. Send only the active context needed for interpretation; a correction such as “actually Sunday at 5pm” must never reinterpret or overwrite sibling tabs.
- [x] Distinguish explicitly mentioned values from omitted ones in the validated interpretation result. Replace clear mentioned fields, retain omitted fields and clear explicitly mentioned replacements that remain ambiguous or unresolved.
- [x] For an active draft already departing at 16:00, “actually at 4” clears the affected time and flags ambiguity; it does not silently retain 16:00. A correction mentioning only a new date preserves an existing known time when the meaning is clear.
- [x] Keep the established Skopje-time, catalog and car-ambiguity rules. Preserve uncertainty and show affected-field warnings while applying other clear changes. A failed correction request preserves the complete previous draft and entered text.
- [x] Maintain dependency validity: changing a city clears a pickup point belonging to the former city; changing a car clears incompatible fuel/consumption information. Do not erase unrelated omitted fields.
- [x] Apply changed cities to their form fields first, then reuse the two-city-string distance request. Invalidate old-route km and respect manual-override rules. A pickup-only correction must not cause a routing request or clear an override.
- [x] Offer Undo for an applied fill/correction. Restore the full previous affected draft, including route, departure, car and other fields, warnings, distance value and whether distance was manually overridden.
- [x] Associate responses with the draft and revision that initiated them. Reject obsolete correction/routing results after newer input, Undo or publication. Switching tabs must not retarget an in-flight response to the newly active draft.
- [x] Prevent correction and Undo from modifying a published ride or causing another publication. Each sibling draft remains unchanged throughout correction, failure and Undo.
- [x] Test through the complete rendered tabbed form with controlled asynchronous provider responses. Cover date/time examples, omitted versus unresolved values, catalog/car invalidation, automatic km and overrides, failed lookups, repeated corrections, tab switches, Undo and stale responses.
- [x] If session recovery has already landed, verify that the corrected current values and an undone current state survive refresh using the same recovery contract. Undo history itself is not a prerequisite for recovery.
- [x] Verify keyboard/focus behavior, warning announcements and mobile use; run relevant and required repository checks. Recheck create-more-drafts, separate publishing and city-first routing, and document the correction/Undo behavior.

## Completion evidence

Implemented and verified on 21 September 2026. See [combined verification](../../../docs/verification/ride-offers.md) for the 393-test suite, live AI and road-distance checks, actual database concurrency guarantees, browser flows, and resolved review findings. Changes are committed locally; nothing was pushed or pulled.
