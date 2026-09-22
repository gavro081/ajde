# AI import pipeline review

Independent reviews compared `66c77192b305356c3ca5ed79fe52b7d12708664d...101e052`,
with a follow-up for optional live-evidence commit `43c2ae4` and the screenshot validation fix.
The reviewers read applicable repository instructions and full parent/ticket specifications.
All changes remain on the local `feature/ai-import-pipeline` integration branch.

## Standards

No hard documented-standard violations or blocking correctness defects were found. Domain
terminology, canonical city routing, server-only provider access, authenticated-client query
ownership, and human review follow the applicable instructions. The user's local-only instruction
supersedes repository workflow instructions requiring remote changes.

Two low-severity judgment calls were identified:

- **Possible Duplicated Code (resolved):** the screenshot UI repeated MIME/size validation already
  exported by `isSupportedScreenshot()`. The UI now uses that browser-safe helper; the follow-up
  review confirmed the resolution.
- **Possible Duplicated Code (deferred):** the checker dispatcher repeats admission, budget, and
  execution/error handling across three tool branches. This is optional maintenance, not a hard
  violation. Explicit tool-specific validation remains readable and tested; a broader refactor was
  deferred to preserve the verified implementation.

The #10 follow-up found no new standards issues. Its tests remain opt-in, and the evidence
distinguishes successes, the initial failure, fixture data, and limitations.

## Spec

No specification findings were identified for #3–#9 or the #10 follow-up. The implementation
follows checker-first delivery, evidence safeguards, bounded execution, deterministic pricing,
duplicate limits, the server flag, screenshot selection, and retention requirements. The baseline
test-import correction restores existing verification and is not an application behavior change.

The live checks use production model runners and explicitly configured fake tool evidence.
Documentation preserves both screenshot passes, the initial price failure, and the subsequent
unchanged-fixture success. These observations do not establish production accuracy, reliable tool
selection, live routing/database behavior, or provider-retention guarantees. Reviewers did not
repeat the provider calls.

The authenticated demo walkthrough through publication remains unperformed and documented.
Fixture-based mobile checks do not establish authentication/database behavior, and publication
is outside the user's local-only authorization.

Standards: zero hard violations, one resolved and one deferred low-severity observation. Spec: zero findings.
