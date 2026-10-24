# Discovery Lab: 26-Exploration verification

## Scope

This local continuation adds the nine approved topics to the reviewed 17-topic
checkpoint `45be48eb17ee4f53bc583ec3b5875ecfa480f69f`:
Machine Workshop, Heat House, Pressure Tank, Moving Plates, Cloud and Rain Lab,
Magnetic Fields, Cell Explorer, Shape Slicer and Adaptation Island.
Dig Through Time is excluded. All 26 have registry content, rich web scenes,
native controls and packaged offline visual rendering.

The original 17 registry entries are unchanged. Existing authentication, module
and per-child access enforcement, persisted override precedence, parent bulk
filters and module-off defaults are preserved. No new child data or persistence
was introduced. The nine are local implementation work, not a publication or
production release.

## Architecture and teaching

- Shared deterministic numerical models and React-free Three.js scene factories.
- A responsive, demand-rendered web host with capped DPR, keyboard view controls,
  direct selection/manipulation, projected labels and GPU-loss fallback.
- The existing hardened offline native renderer, with exact-key bounded state,
  no network/remote assets, no child/auth data and native-readable results.
- Two controlled prediction–comparison–explanation investigations per new topic.
  Specific explanatory answers appear after the comparison, not as spoilers
  before prediction. Numerical results remain available independently.
- Functional scene labels, necessary scientific assumptions and source links;
  no decorative lab branding, promotional taglines or developer commentary.

## Completed checks

- Backend: 792 passed, 217 warnings, clean full run in 410.74 s; latest catalog/access
  recheck 13 passed.
- Frontend: 617 passed across 103 files; lint and TypeScript/Vite build passed.
- Shared API:467 passed across 27 files; module integration 10 passed.
- Security backport/source tests: 25 passed; strict architecture has zero
  boundary violations. Pre-existing oversized files remain outside this change.
- All 26 authenticated desktop 1440×1050 and mobile 390×844 journeys passed,
  including meaningful visible pixel changes for every topic, persisted parent
  bulk/individual access, hidden child entries and direct disabled-page denial.
- Native: 291 unit tests and 463 UI tests passed. Native/shared typechecks,
  generated-document freshness and Android Metro/Hermes export passed
  (886 modules; 7,448,356 B bytecode). Offline documents are 1,821,132 B WebGL
  and 1,030,560 B SVG, each below 2 MiB.
- Existing application browser smoke: 3/3 passed, including chore lifecycle,
  role/auth protections and isolated password recovery.
- All 26 exact native offline-document browser checks passed, including 74 finite
  SVG variants, state-driven rendering, strict protocol/CSP, no remote requests,
  label bounds, cleanup and fallback. These are Chromium document tests, not
  Android/iOS screenshots or native-device tests.
- Independent semantic review additionally exercised 10,731 slicing states and
  4,368 warm-cloud states. Models retain finite bounded outputs and explicit
  validity domains; geometry sections lie in the selected cutting plane.

The native integration report records final unit/UI/export counts and document
sizes. The original 17 verification report remains a historical checkpoint.

## Review corrections

- Cloud controls now stay inside a warm-liquid model domain: 20–35°C starting
  temperature, 2–14 g/kg vapor, 0–2000 m lift. They avoid impossible supersaturated
  starts and subfreezing liquid-only demonstrations. Cloud formation and rain
  remain separate outcomes.
- Transform fault geometry stays locked while strain builds, then offsets at
  slip. The regular threshold is an invented illustration, not quake prediction;
  the lesson explicitly says other boundary types also have earthquakes.
- Heat arrows disappear at matched temperatures and reverse for inward transfer.
  Fixed envelope area, held temperatures and omitted heat paths are explicit.
- Pressure labels distinguish static gauge pressure inside the tank from the
  atmospheric free jet. Shape changes stored volume, not same-depth head.
- Cell transport specifies equal-volume model compartments, relative units and
  passive exchange. Plant cells include mitochondria; not all plant cells have
  chloroplasts. Discrete displayed symbols are not literal molecule counts.
- Adaptation uses inherited population frequencies and deterministic illustrative
  survival weights. Individuals do not choose or change inherited shell color;
  displayed organism symbols are rounded, not fractional animals.
- Slicing uses exact edge-plane intersections and analytic sphere area. Presets
  align with slider steps; camera motion changes only the view, not the cut.
- Final mobile callout layout checks cover27 states (default, rotated and reset
  for nine scenes), with no clipping or overlaps. Displaced labels retain leader
  lines connecting them to the actual feature.
- Full-page review caught mechanics light text against the application's cream
  surface. Explicit exhibit background and high-specificity contrast rules fix
  the integrated page, not merely an isolated dark preview.
- Temporary preview files and configurations are removed from delivered source.

## Limits and reproduction

No APK, native emulator or physical-device run occurred. A rebuilt native binary
containing react-native-webview 13.16.1 is required; do not distribute as OTA-only
to an old binary. Native startup, scrolling/gestures, screen readers, offline
startup, memory pressure and process-loss checks remain release gates.

Run the standard backend/frontend/shared/native/security/architecture commands
from the root guide. The isolated browser wrapper accepts both
`e2e/discovery-lab.spec.ts` and `e2e/smoke.spec.ts`. Offline native commands and
version/tooling caveats are documented in the native integration report.

The user subsequently authorized publication of the combined 26-topic tested tree
through a normal PR merge into `fantasticsquirrel/Chores` master, followed by
cleanup of only that merged feature branch. Publication status is reported
separately from this local verification snapshot. No deployment, production
migration or paid hosted CI run is authorized.
