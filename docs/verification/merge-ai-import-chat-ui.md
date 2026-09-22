# Local merge verification

Merged local `c516e4d` with incoming `f93a557` on `main`, following the user's instruction to
keep the incoming UI and README while preserving both sets of functionality.

Conflict resolutions:

- README retained exactly from the incoming commit.
- Incoming import-page width, heading layout, loading skeleton, manual-entry footer, and
  free/unstated price presentation retained. Local Facebook screenshot / Viber text selection,
  server feature gate, busy/validation guards, checker evidence, and editable-form continuation
  retained alongside them.
- Environment example includes both import/checker and incoming chat-model/feature settings.
- Incoming logo ignore rule retained; docs remain tracked. The test conflict uses the incoming
  description of the same trip-status filter.
- Other incoming changes, including chat assistance, full room history, optional ride prices,
  database migration files, and documentation moves, remain part of the merge.

Verification on the combined tree:

- `npm test`: **864 tests in 66 files passed**, including incoming chat functionality, import
  checking, screenshot selection, and new regression cases combining free-price presentation
  and the manual-entry link with checker evidence.
- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript and route generation.
- Local fixture Chromium checks: desktop and 375 × 812 import layouts rendered; upload → choose
  post → explicit parse → editable-form link passed, with no horizontal overflow or page errors.
  Facebook source and selected text were preserved. Disabled mode hid pipeline controls.
  Exactly one extraction request, one parse request, and no publication requests occurred.

The browser check uses the real import components and app CSS with fixture transport and an
anchor adapter for Next navigation. It does not claim live database/provider coverage. Database
migrations were included as files; this merge did not apply them to any database. No remote
repository or issue changes, pushes, or deployment were performed. The local enabled import
flag was preserved.
