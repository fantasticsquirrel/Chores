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
  Both example packages were rebuilt as version `1.0.1`.

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
  plateau, exact state-driven SVG levels, reset, and the distinction between
  energy and matter flow metadata;
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

## Automated verification

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
