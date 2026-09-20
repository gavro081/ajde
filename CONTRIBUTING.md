# Contributing Guide

This document defines how code is written, committed, and merged in this repository. Follow it exactly — it is the source of truth for any automated or human contributor (Codex included).

## Commits

- Use **Conventional Commits**: `<type>(<scope>): <description>`
- Max 1-2 sentences, no body, no footer.
- **Never add an LLM co-author line** (no `Co-authored-by: Codex` / `Claude` / etc.) — commits must look human-authored.
- Write in the imperative mood ("add", not "added" or "adds").

**Types:**
| Type | Use for |
|---|---|
| `feat` | new feature |
| `fix` | bug fix |
| `refactor` | code change that isn't a fix or feature |
| `style` | formatting, whitespace, no logic change |
| `docs` | documentation only |
| `test` | adding or fixing tests |
| `chore` | tooling, deps, config, build scripts |
| `perf` | performance improvement |

**Examples:**
```
feat(auth): add JWT-based login endpoint
fix(api): correct null pointer on empty playlist response
refactor(db): extract query builder into separate module
docs(readme): add setup instructions for local dev
chore(deps): bump react to 18.3.1
```

## Branching

- **One feature = one branch.** No exceptions, no bundling unrelated changes.
- Branch naming: `<type>/<short-description>`, e.g. `feat/user-auth`, `fix/playlist-null-check`.
- Branch off `main`, do your work, commit with conventional commits, then merge back into `main` directly.
- **No pull requests.** Merge locally/directly into `main` once the feature works.
- Delete the branch after merging to keep things clean.

```bash
git checkout main
git pull
git checkout -b feat/short-description
# ...work, commit...
git checkout main
git merge feat/short-description
git branch -d feat/short-description
```

## General rules

- Keep commits small and scoped to one logical change — easier to review, easier to revert.
- Don't commit directly to `main` except for merges.
- Run tests/build locally before merging, if applicable.
- If a feature branch grows too large or unfocused, split it before merging.
- Keep commit messages free of implementation trivia ("fix typo in var name") — describe the *effect*, not the diff.
