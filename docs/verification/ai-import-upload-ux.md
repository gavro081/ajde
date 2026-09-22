# Import page usability follow-up

The import page uses a compact **Facebook screenshot / Viber text** toggle. Viber mode shows
only a text box; Facebook mode shows only the uploader and detected-post selection. Both modes
share the explicit **Create review draft** button. The source is derived from the active mode.
This replaces the earlier side-by-side layout at the user's explicit request.

- The full upload area opens the file picker and accepts a single dropped image, using the
  existing PNG/JPEG/WebP and 4 MB validation. Invalid drops preserve existing results.
- The chosen filename and size remain visible. Failed reads can be retried without choosing
  the file again; removing a screenshot clears its file, results, and selected screenshot text.
- Detected posts show their kind, position, and selected state. The list scrolls independently;
  the selected post is parsed only when the driver presses Create review draft. Fields can then
  be corrected in the editable ride form. Request and other posts remain selectable.
- Switching modes preserves Viber text and the screenshot selection independently, while clearing
  the previous review. Text edits also clear stale reviews. Parsing uses only the active mode's
  content and automatic source. Removing/replacing an image clears its selected text; the button
  stays disabled until usable content is available.
- Mode switching is blocked while reading or parsing; text editing is blocked while parsing.
- Image data remains transient. The retry file exists only in component memory and is not saved
  to browser storage or the database. Existing server feature gating and APIs are unchanged.

Component tests cover conditional inputs, correct source/content, mode switching and preservation,
drop/retry/remove, multiple-file rejection, stale-review clearing, and disabled mode. Local headless Chromium checks render
the actual import components with app CSS at 375 × 812 and 1280 × 900; the layouts were visually
inspected. The mobile toggle → upload → select → parse → form-link flow and disabled mode passed,
with no horizontal overflow or page errors, one extraction request, one explicit parse request,
and zero publication requests. These checks use fixture transport and a Next link adapter;
they do not claim live authentication, database, or model verification.

The final revised toggle passed **790 tests in 59 files**, including its 14 focused component
tests, `npm run lint`, and the production build including TypeScript and route generation.
Changes remain local on `feature/ai-import-pipeline`; unrelated work and the enabled local `.env`
flag are preserved.

## Standards

The independent review found no hard documented-standard or state-correctness violations.
It identified low-contrast helper text and two border color names missing from the app theme.
Both were corrected to existing, darker theme colors. These are presentation findings, not
documented-standard violations. A toggle follow-up found a visible/accessible textarea label
mismatch, corrected by consistently using “Post text.” No state-handling defects were found.

## Spec

The independent specification review found no functional gaps in the requested toggle. Its stale
documentation finding was corrected in this record and both READMEs. Single-post selection,
explicit parsing, transient images, and the feature flag remain. The cancelled automatic
multi-tab change is not included.

Standards: three presentation/accessibility findings corrected, zero hard violations. Spec:
zero functional findings; stale documentation corrected.
