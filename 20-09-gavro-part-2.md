# Tuesday morning — release documentation and fresh-clone readiness

This track takes the Tuesday documentation and clone-verification work from `PLAN.md`. It is a good
follow-up for Gavro because the ride creation, pricing, and AI import flow is already implemented and
can be documented independently of Dimi's authentication, onboarding, profile, and location-resolver
work.

## Why this task is independent

- It documents behavior already present on `main`: `/rides/new`, `/rides/import`, `/api/parse`, the
  shared ride-draft contract, car selection, price/CO2 estimates, and parser fixtures.
- It does not change `app/login/**`, `app/onboarding/**`, `app/profile/**`, auth guards, Storage, or
  `lib/ai/resolve-location.ts`.
- Dimi's finished features can be added to the final route and architecture inventory later without
  blocking the first documentation pass.
- Ratings are intentionally not selected because they depend on completed identity/profile and ride
  participation flows. A full end-to-end bug bash also needs the two tracks integrated first.

## Phase 1 — audit the repository as it actually runs (~30 min)

- [x] Read the current README and compare every setup claim with the repository.
- [x] Record the supported Node/npm versions and the exact install, development, test, lint,
      type-check, and production-build commands.
- [x] Inventory required and optional environment variables from `.env.example`; clearly separate
      browser-safe values from server-only secrets.
- [x] Verify the Supabase migration/seed order and document how a new developer applies it.
- [x] Confirm which demo paths need authentication and which external dashboard configuration cannot
      be automated from the repository.
- [x] Do not copy real API keys, database passwords, project references, or local `.env.local`
      values into documentation or command output.

Acceptance check: every command and environment variable in the draft instructions maps to a real
script, file, or configuration requirement in the repository.

## Phase 2 — final README content (~60 min)

- [ ] Explain the product in one sentence and identify the primary student/commuter use case.
- [ ] Add a concise feature-status section that distinguishes complete, partial, and planned work.
- [ ] Add reproducible local setup instructions from clone through first successful page load.
- [ ] Add an architecture diagram showing Next.js, Supabase Auth/Postgres/Storage, the OpenAI parser,
      and the review-before-publish boundary.
- [ ] Document the main demo flow: import a post, review the structured result, complete the ride,
      browse/search, request a seat, approve it, and expose contacts only after acceptance.
- [ ] Add an honest AI-usage section. Explain structured extraction, mixed-language handling,
      confidence/warnings, deterministic validation, fixture evaluation, and the location-resolver
      boundary without describing arithmetic pricing as AI.
- [ ] Document calculator assumptions: configured fuel prices, petrol/diesel CO2 factors, unsupported
      fuel types, and driver-editable suggestions.
- [ ] Add the safety/privacy story from `PLAN.md`, matching only behavior that is actually enforced.
- [ ] Add a known-issues section containing real limitations and unfinished integrations. Do not hide
      parser uncertainty, small evaluation sample size, missing policies, or incomplete routes.
- [ ] Link the parser fixture evaluation and database model documentation instead of duplicating
      details that can drift.

Acceptance check: a reviewer can understand what the app does, why AI is useful, how data moves
through it, what is genuinely implemented, and what remains incomplete.

## Phase 3 — fresh-clone rehearsal (~45–60 min)

- [ ] Test the README from a clean temporary clone or clean worktree, not from an already-configured
      development directory.
- [ ] Follow only the documented commands and `.env.example`; note every hidden prerequisite.
- [ ] Run install, migrations/seed instructions where credentials allow, tests, lint, type-check, and
      the production build.
- [ ] Ask another team to follow the instructions without verbal shortcuts and capture where they
      hesitate or fail.
- [ ] Fix the README rather than coaching around missing steps.
- [ ] Verify all relative links, Mermaid rendering, command working directories, and filenames.
- [ ] Re-run the documented happy path after incorporating the external feedback.

Acceptance check: another developer can clone the repository, identify the required external
configuration, start the application, and run its verification commands using the README alone.

## Phase 4 — final release checks (~20 min)

- [ ] Reconcile the README feature list and route inventory with Dimi's merged work without changing
      files owned by that track.
- [ ] Confirm the known-issues list still reflects the final integrated state.
- [ ] Confirm Git contains no `.env.local`, API keys, database credentials, generated build output,
      or local screenshots with sensitive data.
- [ ] Run Markdown/link checks if available, then perform one final visual read on GitHub.
- [ ] Commit the documentation separately with a conventional commit message.

## File ownership and collision avoidance

This track should primarily own:

- `README.md`
- Documentation-only architecture diagrams or screenshots, if needed
- Links to `ride-share-app/fixtures/posts/README.md`
- Links to `ride-share-app/supabase/DATABASE_MODELS.md`

Do not modify Dimi's auth/profile/location implementation merely to make the documentation easier.
If the README exposes a real implementation bug, record it clearly and coordinate ownership before
changing code.

## Deliverable

A truthful, reproducible README that satisfies the Tuesday rubric items for run instructions,
architecture, AI usage, safety, and known issues, plus evidence that the instructions survived a
fresh-clone test.
