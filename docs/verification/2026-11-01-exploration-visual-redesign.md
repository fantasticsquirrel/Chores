# Chance Carnival + Leaf Energy Lab visual redesign verification

Date: 2026-11-01

Branch: `feat/discovery-learning-overhaul`

Starting revision: `6e8292670e44ab0b85501c50e48f4c90d866a45b`

## Verified scope

- Chance Carnival now uses a responsive SVG spinner/die, readable pattern and
  number encoding, an actual last-draw pointer, observed bars with expected
  markers, a shared evidence dock, and direct 12-versus-1,200-trial
  distributions. Every value is derived from the existing probability model.
- Leaf Energy Lab now uses a responsive semantic SVG that connects leaf,
  tissue, cell, chloroplast and stoma scales. Light is identified as energy;
  water and carbon dioxide are matter inputs; sugars and oxygen are outputs.
  The illustration, output index, input meters and limiting-input note update
  from the existing shared model.
- Both activities retain prediction gates, two guided comparisons,
  explanations, open controls, reset behavior and concise progressive model
  caveats. Motion is limited to meaningful state changes and disabled by the
  reduced-motion media query.
- The Chance offline package vector result now uses observed bars with expected
  markers. The Leaf offline fallback vector now labels energy and matter flows.
  Chance remains at `1.0.1`; the corrected Leaf package was rebuilt as `1.0.2`.

## Independent supervisor review fixes

All five release findings from the rendered-image review were corrected:

1. The Leaf ring now has a visible `Toy activity index` name and exposes a
   named `meter` with its 0–100 value to assistive technology.
2. Web desktop/mobile and offline fallback sugar paths now say `to the plant`;
   the invented index no longer appears on a matter arrow. Output paths use
   only an active/inactive cue, not a numeric sugar-flow encoding.
3. Mobile now shows a 12px structure key stating that leaf tissue contains
   cells with chloroplasts and that a stoma is a pore for gas exchange. The
   graphic's accessible description names the same nested relationship.
4. The live illustration/instrument precedes both guided cards on mobile.
5. The original honest full-page/component captures remain, including fixed
   navigation where it naturally occurs. A separate ordinary-viewport set was
   scrolled normally and checked geometrically so each operated art/challenge
   focus stays above the mobile navigation; no product CSS or screenshot-only
   hiding was used.

## Browser behavior and accessibility evidence

The isolated built app used
`/tmp/learning-module-fixture/chore_tracking.db` and the local capture wrapper;
no production service or data was used.

`node /tmp/verify_visual_redesign.mjs` passed at 1440 × 1000 and 390 × 844 for
both activities. It verified:

- keyboard selection of every guided prediction and keyboard activation of the
  trial actions;
- Chance 12-trial and 1,200-trial evidence persistence, the 2-of-5 weighted
  comparison, reset, open controls, and agreement between the visible die face
  and the model's last draw;
- Leaf zero-water and zero-carbon-dioxide boundary behavior, the 35% water
  plateau, exact state-driven input levels, active/inactive output pathways,
  reset, and the distinction between energy and matter flow metadata;
- the visible/named Leaf activity meter, non-numeric sugar transport label,
  mobile anatomy key and activity-first mobile order;
- descriptive graphic labels, numeric/non-color encodings, no document or
  activity-stage horizontal overflow, no failed responses or browser console
  errors, and a 12px minimum for visible activity text.

This was a keyboard and programmatic-label review, not a session with a real
screen reader or a full assistive-technology matrix.

## Matched visual evidence

Raw before/after captures are under
`/tmp/ui-captures/exploration-visual-redesign/2026-11-01/` and include initial
and operated states for both activities at desktop 1440 × 1000 and mobile
390 × 844, as full-page and component images. `before-manifest.json` and
`after-manifest.json` record the matched cases and layout measurements.

All 16 final images and all eight readable component before/after composites
were inspected after the final build and copied to:

- `/root/.openclaw/workspace/media/exploration-visual-redesign/finals/`
- `/root/.openclaw/workspace/media/exploration-visual-redesign/comparisons/`

The untouched `before-*` baseline files retain their original capture times.
The final build was recaptured into the `after-*` paths. Additional focused
evidence contains 12 ordinary viewport cases (both operated art panels and all
four operated challenges at desktop and mobile), each with a viewport image,
standalone image and recorded target/navigation geometry:

- `/tmp/ui-captures/exploration-visual-redesign/2026-11-01/focused/`
- `/root/.openclaw/workspace/media/exploration-visual-redesign/focused/`

The six concise files in
`/root/.openclaw/workspace/media/exploration-visual-redesign/share/` are the
readable Telegram-friendly final art, operated-challenge and mobile
before/after graphics. SHA-256 values for all staged PNGs are recorded in
`/tmp/exploration-visual-redesign-media-sha256.txt`.

## Focused follow-up verification

The supervisor fixes changed only Leaf web presentation/tests and its offline
fallback package, so the broader already-passing suites below were not repeated.
The affected scopes passed after final formatting and package generation:

- `npm run lint --workspace frontend`
- `npm run build --workspace frontend`
- focused frontend Vitest — 3 files, 8 passed, 11 skipped by the test-name filter
- focused offline education regressions — 1 file, 2 passed, 6 skipped by the
  test-name filter
- deterministic Leaf package build plus server validation —
  `photosynthesis-package 1.0.2`, ZIP SHA-256
  `1b25ab99413747b2493827bfe1c53b0cf9503fb75b0072ab02e3e4087c6111cb`
- final deterministic browser interactions — four module/viewport cases, 12px
  minimum visible activity text, no overflow, no browser/response errors
- fresh screenshot capture — eight matched raw cases and 12 focused
  ordinary-viewport cases; every mobile focused target ended above the fixed
  navigation according to `focused-manifest.json`
- `git diff --check`

## Automated verification

The following broader gates were completed for the original redesign through
revision `80b64261b49ac739945f29af3bc4346af867d7c6`; they are retained here as
the unchanged adjacent verification record rather than represented as reruns
for the supervisor-only fix:

Passed:

- `npm run lint --workspace frontend`
- `npm run test --workspace frontend` — 147 files, 831 tests
- `npm run build --workspace frontend`
- `FAMILY_TREE_CONTRACT_PYTHON=.venv/bin/python npm run shared-api:gate` —
  29 files, 481 tests
- `npm run modules:validate` — 2 files, 10 tests
- `.venv/bin/python scripts/architecture-report.py --strict` — zero boundary
  violations
- `npm run typecheck --workspace mobile`, including offline-scene verification
- focused mobile Discovery UI tests — 4 suites, 58 tests
- native scene-state test — 1 file, 6 tests
- focused Chance/Leaf offline worker regressions — 6 tests
- deterministic build and server-side validation of both `1.0.1` package ZIPs
- `npm run security:backports` — 51 tests
- `npm audit --workspace frontend --omit=dev --audit-level=high` — zero
  vulnerabilities
- authored-source scan for `dangerouslySetInnerHTML`, direct `innerHTML`,
  `eval`, `new Function`, `javascript:` and `document.write` — no matches
- `git diff --check`

The first shared-contract run used system `python3` and could not collect five
family-tree suites because that interpreter lacks Pillow and
`email_validator`. Re-running the same gate with its
`FAMILY_TREE_CONTRACT_PYTHON` override pointed to the repository virtualenv
passed all 481 tests.

The broader shared offline-package run completed 37 of 38 tests. Its unrelated
`pollinator-express` exhaustive case took 48.6 seconds but hardcodes a
30-second test timeout. The six focused Chance/Leaf worker tests passed, and
both changed archives separately built and validated successfully.

The frontend build retained existing Rollup warnings about Zod comment
annotations and chunks larger than 500 kB; it completed successfully.

## Limitations

- Native behavior and scene contracts were regression-tested, but native
  visuals were not changed and no simulator, device or APK screenshot proof was
  produced.
- Offline package parity is limited to Chance's vector evidence and Leaf's
  fallback process view. Their primary 3D package scenes were not redesigned.
- Chromium captures and programmatic accessibility checks do not replace a
  browser/assistive-technology compatibility matrix.
- No merge, deployment, production process, production database or production
  configuration was touched.
