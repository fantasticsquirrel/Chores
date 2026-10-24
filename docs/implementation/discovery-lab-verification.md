# Discovery Lab implementation verification

> Historical17-topic checkpoint. For the later local26-topic continuation, see
> [26-Exploration verification](discovery-26-verification.md).

Verified locally on 2026-10-24. Repository: `fantasticsquirrel/Chores`.
Feature branch: `feat/discovery-lab` (local only).
Base: `587f81a8cb9d045593fcb2feb9aa2f9a2fea51a1`, `master`, rechecked unchanged
through GitHub at 01:35 UTC. The original seven-topic checkpoint was
`222fb654bd80adc75694d9cb462034ab6702369a`; this report supersedes it.

## Implemented scope

- Seventeen registry-backed Explorations, 34 guided experiments, primary-source
  references, grade bands, subjects, tags, search and filtering.
- Integrated web and native navigation/catalog/details/parent controls, preserving
  existing authentication and household/child models.
- Topic-specific lit 3D exhibits and precise SVG instruments. Native uses packaged
  offline scenes with native controls and accessible results; this is not a
  device-rendering verification claim.
- Authoritative global/household/user module gates, view/manage separation,
  child-self and parent-household scoping, CSRF writes and security audit events.
- Module off by default. Inside a granted module pages default on; persisted
  per-child overrides win. Bulk filters save current matches, leave unmatched
  settings alone, and do not silently become rules for future pages.
- Additive migration and data-preserving disable-only rollback. No child
  telemetry, grades, external child-data transmission or new production state.
- Durable education-first editorial standard, extension guide and modeling limits.

## Completed automated verification

- Backend: **792 passed**, 217 warnings, one clean monolithic run (386.90s).
  This replaces the earlier seven-topic report's split-run accounting.
- Frontend: **600 passed**, 98 test files.
- Shared API: **429 passed**, 24 test files. Module integration: **10 passed**.
- Native: **280 unit + 424 UI tests passed**. Seventeen exact offline-document
  browser checks cover all topics and all74 SVG states. Native/shared typechecks,
  bundle freshness and Android Metro/Hermes export passed (875 modules,7.3MB).
  The two offline HTML documents are1,778,108 and1,028,445 bytes, each<2MiB.
- Security backport/source gates: **25 passed**.
- Frontend lint and production builds passed. Strict architecture check reports
  zero boundary violations; all new production components remain under350 lines.
  Pre-existing oversized application files are still reported separately.
- Authenticated all17 browser journey: **2/2 passed**, desktop1440×1050 and
  mobile-sized390×844. Each exhibit changes visible pixels after manipulation.
  Parent filtered bulk and individual changes persist; children cannot list or
  directly request disabled pages. No horizontal overflow or page errors.
- Existing application browser smoke: **3/3 passed**, covering chore lifecycle,
  authentication/role protection and isolated password recovery.
- Latest registry/backend content recheck: **13 passed**.
- Moon exemplar desktop/mobile: **2/2 passed**. Tactile desktop/true-touch:
  **2/2 passed**. Physical exhibit desktop/true-touch and visual checks passed.
- Independent review rendered all17 full detail routes at both viewport sizes
  using registry-backed API fixtures, with no page errors, horizontal overflow or
  external requests. Scene-specific extreme-state and direct manipulation checks
  supplement the general journey.

## Corrections found during review

- Removed reflected light at equal refractive indices; retained a straight
  transmitted ray and explanatory result.
- Corrected Moon fallback disposal after actual GPU context loss; context-loss
  checks include other WebGL scenes and retain useful controls/results.
- Enlarged optics instrument labels for mobile. Added leaf structure labels,
  visible input/output mapping and meaningful transport legend.
- Castle sight lines are off by default/reset and explicitly identified as a
  nonstructural overlay. Optional dashed rays project outside walls, not as a
  misleading cable loop. Gate/drawbridge structures remain actual geometry.
- Shared comparison experiments explicitly restore controlled settings after
  reset, and Moon asks for prediction before moving to the target phase.
- Removed promotional eyebrows, mood taglines, decorative bench names and
  redundant meta copy. Necessary scientific caveats and attribution remain.
- Corrected the GPU test harness to compare composed screenshots rather than
  reading discarded WebGL drawing buffers. This was a test issue, not a blank
  rendered-scene defect.

## Release limitations

- No physical Android/iOS device, emulator, APK installation or native visual
  parity verification. Android Metro/Hermes export checks JS/assets only.
- `react-native-webview`13.16.1 requires a rebuilt native binary. Do not ship this
  as an OTA-only update to binaries lacking that module.
- Expo online dependency verification encountered a proxy/network timeout.
  Installed SDK compatibility was checked locally. Earlier checks noted existing
  patch drift: expo56.0.23→~56.0.24, expo-sharing56.0.26→~56.0.27 and
  jest-expo56.0.5→~56.0.6. This task does not silently upgrade that baseline.
- Vite retains large-chunk warnings; scene code is lazy-loaded, DPR is capped,
  resources are disposed and animations can be paused. Real low-end device
  startup/memory/gesture/screen-reader testing remains required before release.
- No remote push, PR, merge, deployment or production migration was performed.

## Reproduction

Use the repository's pinned Node20 toolchain and backend virtualenv. Run
`pytest backend/tests`, `npm test`, `npm run shared-api:gate`,
`npm run modules:validate`, `npm run lint`, `npm run build`, native typechecks/full
unit/UI tests, `npm run security:backports` and
`python scripts/architecture-report.py --strict`.

`npm run test:smoke --workspace frontend -- e2e/discovery-lab.spec.ts` runs the
isolated Discovery journey; without arguments it runs the existing application
smoke suite. The wrapper creates disposable SQLite, fictional fixtures and a
loopback server. Never point its seed at production. For offline renderer
freshness/security/browser checks see the native rendering report.

Cloud browser validation used a compatible headless Chromium executable with
Chromium sandbox enabled and only `--disable-dev-shm-usage`; no user browser,
production data or security bypass was used. Screenshots/logs/fixture databases
are intentionally excluded from the source handoff archive.
