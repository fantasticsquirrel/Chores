# Light Bending Studio redesign verification

Date: 2026-11-01

Exploration: `reflection-refraction`

Base: `eb252785ba7bc9956da0c10a83101835096552af`

## Scope and outcome

Only Light Bending Studio and its shared optics contract, web/native surfaces,
isolated rich package, registry copy, tests and evidence were changed. The
redesign replaces an unguided numerical bench with two prediction-first,
controlled comparisons while keeping an open boundary explorer. It does not
start Gravity Drop Lab or change another exploration.

The first comparison holds glass → air fixed and crosses the 41.8° critical
angle from 40° to 43°. The second holds the incident angle at 30° and reverses
air → glass versus glass → air. Each result remains switchable after the run so
the learner does not have to remember a prior ray. Feedback reports the
measured result, distinguishes a matching from a differing prediction, and asks
the learner to explain the causal relationship.

## Science and model checks

The shared model and package-local security-boundary model were checked against
the OpenStax sources recorded in `docs/reflection-refraction-copy-research.md`.
Angles are measured from the normal in both media. The model distinguishes
reflection, refraction, exact critical-angle transmission along the boundary,
and total internal reflection only above the critical angle while traveling
from higher to lower refractive index.

Checked values, rounded only for display:

- glass → air critical angle: 41.81°;
- glass → air at 40°: 74.62° transmitted; at 43°: TIR;
- air → glass at 30°: 19.47°; glass → air at 30°: 48.59°;
- water → air critical angle: 48.61°;
- equal indices: straight transmission and no reflected branch in this ideal
  boundary model;
- 0° incidence: the transmitted ray stays on the normal.

The visible model boundary says that the single-color geometric ray omits
absorption, scattering, polarization and color separation. Ray brightness is
fixed for visibility and is not an energy-split calculation.

## Visual and interaction implementation

The web surface uses a layered SVG optical instrument rather than flattening
the prior attractive bench into generic cards. It adds named and shaded FROM/TO
media, index values, normal and boundary, a two-sided protractor, angle arcs,
critical-angle marker, luminous incident/reflected/refracted rays, physical
emitter treatment, explicit TIR state and a compact ray key. Controls remain
native keyboard-operable elements; result copy is live text, not color-only.
The component has focus-visible styles and a reduced-motion rule.

The native surface consumes the same shared optics model and implements the
same baseline, prediction gates, two comparisons, retained trials, open
materials/angle controls, reset and caveat. Its teaching behavior and numerical
results match web, but the artwork is intentionally a simpler layered React
Native schematic rather than pixel-identical SVG.

The isolated `worker-rich-v1` package mirrors the equations, baseline, gated
comparisons, trial switching, feedback and caveat inside its package-local
boundary. It retains the existing circular metal instrument and arbitrary
bounded index controls. Known values are labeled Air, Water or Glass; other
values are labeled Custom. Thus the package is behaviorally aligned but has a
different visual frame and a broader numeric material control than bundled
web/native.

## Visual evidence

True before captures were made from the clean base before source edits using an
isolated local app and fixture database. No production data or deployed service
was used. Matched after captures were then made from the final production
frontend build at desktop 1440×1000 and mobile 390×844, for initial and operated
states, with full, component and artwork crops:

- immutable capture set and manifests:
  `/tmp/ui-captures/exploration-series-reflection-refraction/2026-11-01/`;
- staged before/after artwork comparisons:
  `/root/.openclaw/workspace/media/exploration-series/reflection-refraction/comparisons/`;
- standalone central artwork at desktop, mobile and 320 px:
  `/root/.openclaw/workspace/media/exploration-series/reflection-refraction/artwork/`;
- normal-scroll critical-angle and direction evidence, captured above the fixed
  mobile navigation:
  `/root/.openclaw/workspace/media/exploration-series/reflection-refraction/evidence/`;
- staged artifact checksums:
  `/root/.openclaw/workspace/media/exploration-series/reflection-refraction/SHA256SUMS.txt`.

The browser audit found no horizontal overflow, undersized action targets,
active animation, console errors or failed requests at either primary viewport.
Every central-art SVG text node measured at least 14 px at 320 px viewport
width; the FROM label did not overlap the frame screw.

## Independent critique and iteration

Two independent Codex review passes inspected the implementation and evidence.
The first identified the wrong initial teaching state, hidden causal
explanation, package medium-shading and trial-accessibility problems, small
mobile labels and stale-cache screenshot risk. The second identified the need
for an explicit learner explanation prompt, a 320 px robustness check, outcome
text in package trial labels and a FROM-label/frame-screw collision. These
findings were addressed before the final build and capture. Final browser
measurements and image inspection confirmed the corrected evidence.

Review transcripts are retained outside the repository at:

- `/tmp/reflection-refraction-independent-review.txt`;
- `/tmp/reflection-refraction-independent-rereview.txt`.

## Verification results

Test-first failures were observed before implementation: the new shared optics
model did not exist, and the web flow lacked the prediction gates and trial
actions. The final focused and broad checks were:

- shared family API: 31 files, 491/491;
- module validation: 2 files, 10/10;
- backend Discovery package/security suites: 50/50, with two existing
  third-party warnings;
- rich package runtime/schema regression: 12/12 after correcting conditional
  section button IDs to match the buttons actually emitted;
- final full frontend suite: 148 files, 836/836;
- frontend ESLint: passed with zero warnings;
- frontend production typecheck/build: passed; only the existing Zod annotation
  and large-chunk warnings were emitted;
- mobile generated-scene freshness and TypeScript typecheck: passed;
- mobile unit set: 32 files, 296/296;
- native optics and adjacent scene integration focused suites: passed;
- security backports/upstream artifact verification: 51/51;
- strict architecture report: zero boundary violations; it continues to report
  repository hotspots, including the cohesive optics artwork component;
- production dependency audit: command exited successfully with seven low
  `deepmerge` advisory paths already covered by the repository's verified
  source backport; no exception was widened;
- browser interaction audit: keyboard prediction flow, both retained trial
  switches, material/angle boundaries, equal-index behavior, normal incidence,
  TIR and reset all passed at desktop and mobile;
- deterministic package `reflection-refraction-package` 1.0.1 built and
  server-validated twice with identical ZIP SHA-256
  `2306740380bebec9d4cb8181757bf6ee42bb5209a7e7ce8ee332bb2e5946ffab`;
- `git diff --check`: passed.

The first broad frontend run had two failures: the package schema issue above,
which was fixed and passed 12/12, and an unrelated dashboard deferred-promise
timing flake. The dashboard file passed 8/8 immediately in isolation, and the
final full rerun passed all 836 tests.

The full mobile UI set retained one unrelated, pre-existing Family Tree failure
in `scopeRecoveryRemediation.test.tsx` (`findByRole("button", { name:
"People" })` timed out even though the rendered diagnostic tree contained that
accessible button). The run otherwise passed 61 suites and 529 tests; all
changed native optics tests passed.

## Remaining gaps

No physical mobile-device or real screen-reader session was available. Native
and isolated-package visual differences are disclosed above. The current
module is complete, but the overall 26-exploration series remains open: four
entries are complete and 22 remain. Gravity Drop Lab is next and remains
pending parent review of this checkpoint; it was not started.
