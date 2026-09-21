# Enforce booking decision eligibility atomically with ride completion

## What to build

Prevent an approval already in flight from accepting a booking after the ride departs or completes. The implemented application checks reject later requests, but a decision that reads an eligible ride before departure can pause, then write after completion. Enforce the lifecycle rule at the database mutation boundary and preserve the current driver-facing decision flow.

The user explicitly deferred this database hardening during implementation. This ticket is follow-up work, not an applied migration.

## Acceptance criteria

- [ ] Coordinate the narrow migration with the database owner before rollout; keep Dimi's existing queries compatible and avoid a project-wide RLS rollout.
- [ ] Serialize a requested booking's transition to accepted or declined with updates to its ride. Lock the relevant ride and verify published/full status and future departure in the same transaction as the booking decision.
- [ ] Evaluate the actual current time after obtaining the lock, rather than relying on a transaction-start timestamp that may predate a wait across departure.
- [ ] If completion wins the race, the later decision fails and leaves booking status and seats unchanged. If an eligible decision wins, completion observes the committed participation and preserves it.
- [ ] Preserve booking ownership and requested-state checks at application entry points, existing capacity protection, idempotent completion, and passenger cancellation, including cancellation after completion.
- [ ] Surface a lifecycle-specific error to the driver without reporting every guard failure as insufficient capacity.
- [ ] Include a new migration, updated database-model documentation, generated-type verification/regeneration, and relevant rollback-safe database tests together. Follow existing security-definer, fixed-search-path, and function-execution permission conventions where applicable.
- [ ] Test overlapping transactions in both orders, a lock wait crossing departure, ordinary future acceptance/decline, cancelled/draft/completed rejection, accepted booking cancellation, and unchanged seat counts after rejected decisions. Database doubles alone are insufficient for the transaction guarantee.
- [ ] Verify the driver-dashboard error behavior and impact totals after the interleavings. Run focused tests, typechecking, lint, and the documented production build before local integration.
- [ ] Implement on a separate feature/fix branch with Conventional Commits. Do not push without explicit user approval.

## Blocked by

- Ticket 03: Complete a departed ride and close booking decisions (application implementation is available).
- Database-owner coordination before migration rollout; the user chose to defer this work.
