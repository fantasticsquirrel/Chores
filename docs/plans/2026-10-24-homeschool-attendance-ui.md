# Homeschool attendance and semester reports

Scope: calendar-first web/native attendance UX, multi-subject day editors, safe previous-day copying, subject colors, collapsed logs, and private semester PDF reports. No release/build metadata or Discovery changes.

- [x] Verify existing PDF export is absent; inspect actual attendance/grade model.
- [x] Reproduce and fix web household/refresh race with regression tests.
- [x] Complete web/native dialogs, saved-state handling, subject picker and layout tests.
- [x] Add authenticated household-scoped PDF export with opt-in notes and actual grade labels.
- [x] Independently review partial saves, navigation races and export authorization.
- [x] Run web/mobile/shared/backend gates and real-browser desktop/mobile smoke.
- [x] Render and visually inspect synthetic single/multipage PDF reports.

Copy previous day deliberately uses the selected child's latest strictly earlier attendance date, including across semester boundaries. Attendance has no semester ownership; subjects are household-wide. The editor displays the source date and keeps all copied present/absent statuses and comments editable. No writes occur until Save. Existing unselected attendance is not deleted.

## Verification

- Web: lint and production TypeScript/Vite build pass; full frontend suite passes (114 files, 668 tests), plus final focused checks after the last draft-reset fix.
- Native: typecheck, 294 unit tests and 479 UI tests pass. Online Expo dependency validation timed out through the environment proxy; offline validation reports dependencies current. No native dependencies changed, APK built, or physical-device testing performed.
- Shared contracts: 28 files, 472 tests pass.
- Backend: 823 full-suite tests pass; final seven PDF-focused tests also pass, covering two cases added after the full suite began. Existing deprecation warnings remain.
- Real browser: desktop (1440px) and mobile-width (390px) smoke tests pass against the isolated local API, including actual PDF downloads, multi-subject save, cross-semester copy, no history, Escape/Back/reopen, and rapid duplicate submission plus partial-failure retry. Screenshots inspected for layout/overflow.
- PDF: one-page summary and five-page notes report rendered and inspected; supported accented/Greek/Cyrillic text, literal markup, no-grade and empty-semester cases verified. Missing font glyphs are explicitly represented by Unicode code points with a report notice, not silent squares. Embedded font/license packaging verified.
- Independent review fixes: preserve acknowledged writes even when reload fails after navigation; reject impossible URL dates; reconcile removed/other-household selections; prevent stale callbacks and readonly portal editing.

## Report contract and delivery

GET /homeschool/semesters/{semester_id}/report.pdf accepts household_id, child_id and include_notes (false by default). It uses existing parent/module/household authorization, local PDF generation, private no-store responses and safe filenames. Semester boundaries are inclusive. Distinct present days are separate from subject present/absent entry totals. Only actual nonempty grades linked to the selected semester are shown; overall grades are not relabeled as semester grades, and no averages are inferred. Notes include attendance comments and day notes only when opted in. Web downloads a private PDF; native uses the existing share sheet and cleans its temporary cache file.

Deployment must install the added ReportLab runtime dependency; pypdf is a test extra. No database migration or existing API shape change. No push, merge, deployment, APK/version/release metadata changes were part of this local task.
