# Import page usability follow-up

The import page now presents screenshot upload and text entry side by side on desktop, stacked
on mobile. It retains the existing flow: extract posts, choose one, edit its text, explicitly
create a review draft, then continue to the ride form. Uploading or selecting does not publish.

- The full upload area opens the file picker and accepts a single dropped image, using the
  existing PNG/JPEG/WebP and 4 MB validation. Invalid drops preserve existing results.
- The chosen filename and size remain visible. Failed reads can be retried without choosing
  the file again; removing a screenshot clears its file and results while preserving edited text.
- Detected posts show their kind, position, and selected state. The list scrolls independently;
  selecting a post focuses the editable text field.
- Text/source edits clear the previous review so its continuation link cannot refer to stale
  content. Those inputs are disabled while parsing. Upload and parse actions retain busy guards.
- Image data remains transient. The retry file exists only in component memory and is not saved
  to browser storage or the database. Existing server feature gating and APIs are unchanged.

Component tests cover drop/retry/remove, selection focus, multiple-file rejection, stale-review
clearing, and the existing text and screenshot workflows. Local headless Chromium checks render
the actual import components with app CSS at 375 × 812 and 1280 × 900; the layouts were visually
inspected. The mobile upload → select → edit → parse → form-link flow and disabled mode passed,
with no horizontal overflow or page errors, one extraction request, one explicit parse request,
and zero publication requests. These checks use fixture transport and a Next link adapter;
they do not claim live authentication, database, or model verification.

Before the implementation commit, `npm test` passed all **791 tests in 59 files**,
`npm run lint` passed, and `npm run build` passed including TypeScript and route generation.
Changes remain local on `feature/ai-import-pipeline`; unrelated work and the enabled local `.env`
flag are preserved.
