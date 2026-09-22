# Plan archive

How the project was planned and split across the five hackathon days. Each plan was a handoff
document written before the work started and then executed on feature branches (see
[CONTRIBUTING.md](../CONTRIBUTING.md)). They are kept as a record of our process, not as current
documentation — for how the app works today, read the [README](../README.md).

We wrote most plans with AI assistance from our own scope decisions, then used them as prompts and
checklists for AI-generated implementation that we reviewed and merged.

## Master plan

| File | What it covers |
| --- | --- |
| [PLAN.md](PLAN.md) | Product sentence, scope tiers, estimation in AI "cycles", schedule to the Tuesday 15:00 deadline, rubric mapping |

## Per-day tracks

Two tracks ran in parallel each day so that people could work without touching the same files.

| Day | File | Owner | Scope | Status |
| --- | --- | --- | --- | --- |
| Sun 20 Sep | [20-09-dimi.md](2026-09-20/20-09-dimi.md) | Dimi | Track A: student auth, onboarding, profiles, canonical location resolution | Done |
| Sun 20 Sep | [20-09-dimi-IMPLEMENTATION.md](2026-09-20/20-09-dimi-IMPLEMENTATION.md) | Dimi | Write-up of how Track A was implemented, branch/commit map | Record |
| Sun 20 Sep | [20-09-gavro.md](2026-09-20/20-09-gavro.md) | Gavro | Track B: manual ride creation, cars, fuel/CO2 price estimate, group-post import parser | Done |
| Sun 20 Sep | [20-09-gavro-part-2.md](2026-09-20/20-09-gavro-part-2.md) | Gavro | Release documentation and fresh-clone verification | Done |
| Mon 21 Sep | [21-09-dimi.md](2026-09-21/21-09-dimi.md) | Dimi | Tier 2: natural-language search, match explanations, same-gender filter | Done |
| Mon 21 Sep | [21-09-pero.md](2026-09-21/21-09-pero.md) | Pero | Tier 2: share-my-trip links, public ride Q&A, CO2 counters | Done |
| Mon 21 → Tue 22 Sep | [21-09-dimi-2.md](2026-09-21/21-09-dimi-2.md) | Dimi | Tier 3: private Realtime room per ride | Done |
| Mon 21 → Tue 22 Sep | [21-09-pero-2.md](2026-09-21/21-09-pero-2.md) | Pero | Tier 3: post-ride ratings and the shared RLS/Realtime policy checkpoint | Done |
| Tue 22 Sep | [22-09-dimi.md](2026-09-22/22-09-dimi.md) | Dimi | Full ride-room history and AI chat summaries and questions | Done |
| Tue 22 Sep | [22-09-ai-pipeline.md](2026-09-22/22-09-ai-pipeline.md) | — | Screenshot → reader → parser → tool-using checker pipeline | In progress |

## Related records

- [docs/adr/](../docs/adr/) — architecture decisions (city-to-city road distance)
- [docs/research/](../docs/research/) — research behind those decisions
- [docs/tickets/](../docs/tickets/) — tickets split out of a plan
- [docs/verification/](../docs/verification/) — review findings and how each was fixed
