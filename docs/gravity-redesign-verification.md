# Gravity Drop Lab redesign verification

Date: 2026-11-01

Branch: `feat/discovery-learning-overhaul`

Status: **implementation complete; review checkpoint ready**. Gravity is counted
complete in the ordered redesign queue. This is an implementation and evidence
checkpoint, not parent visual acceptance or merge, deployment, publication, or
production authority.

## Learning design and shared model

The redesign answers one question: **What changes a vacuum drop: object mass or
local gravity?** It contains two prediction-gated controlled investigations:

1. Change only mass: compare 1 kg and 10 kg from 20 m under Earth gravity. Both
   land in 2.02 s; their weights are 9.81 N and 98.1 N.
2. Change only local gravity: compare the same 5 kg mass from 20 m on Earth and
   the Moon. The modeled times are 2.02 s and 4.97 s; weights are 49.1 N and
   8.1 N.

Both flows require a prediction, run an observable comparison, preserve named
evidence, respond to the chosen answer, ask a causal follow-up, and reset to a
common state. Open controls retain bounded Earth, Moon, and Mars comparisons.
Jupiter is excluded because this floor-drop model requires a solid surface.

`packages/family-api/src/discovery-models/gravity.ts` is the authoritative web
and native calculation. It bounds height, mass, gravity, and time and computes
acceleration, weight, fall time, impact speed, and position. The isolated
package worker uses the same equations and fixed comparisons through its
package-local contract.

The evidence plot now scales its vertical axis from the actual comparison
height (5–50 m), rather than hard-coding 20 m. A regression exercises 50 m.

## Artwork, interaction, and accessibility

- Web retains and improves the rich twin Three.js vacuum towers. The central
  apparatus adds a dimensional plinth, illuminated landing rings, gravity
  arrows, stronger lighting, clearer shadows, and responsive framing. It was
  not replaced by cards or a sparse SVG.
- The rich package retains its copied Three.js tower renderer with the same
  plinth, rings, gravity vectors, lighting, and camera refinement.
- Native pairs a platform-native two-lane teaching schematic with the
  regenerated offline Three.js tower scene. This is lesson/model parity, not
  pixel parity.
- Motion starts paused. Play/pause, restart, range input, pointer scrubbing,
  and ArrowLeft/ArrowRight/Home/End keyboard scrubbing expose the same results.
  Reduced motion leaves the chart and all text evidence available.
- The second plot line and evidence card use dashed styling as well as a
  different color. Every result is named numerically in readable text.
- Per-frame lane readouts are no longer in an `aria-live` region. Settled
  comparison feedback remains the polite status announcement, preventing
  assistive-technology flooding during animation.
- The 3D instruction and fallback/model-boundary prose have explicit readable
  foreground/background styling. Focus indicators, native controls, semantic
  headings, 44 px action targets, and descriptive canvas labels remain.
- The detail page no longer repeats generic lesson prose beneath the complete
  activity.

## Research reviewed

- [OpenStax, Free Fall](https://openstax.org/books/university-physics-volume-1/pages/3-5-free-fall)
- [NASA Glenn, Free Falling Objects](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/free-falling-objects/)
- [NASA, What Is Microgravity? Grades 5–8](https://www.nasa.gov/learning-resources/for-kids-and-students/what-is-microgravity-grades-5-8/)
- [NASA NSSDCA, Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/)
- [NASA NSSDCA, Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)
- [NASA, Jupiter Facts](https://science.nasa.gov/jupiter/jupiter-facts/)

The visible model boundary states: one-dimensional release from rest, constant
local gravity over a short height, vacuum/no air or wind, no buoyancy, rotation,
or terrain, an ideal floor, and rescaled tower distance. Equal drawn ball size
does not encode mass.

## Verification completed

- Shared Gravity model plus catalog content: 2 files, 33/33.
- Focused web simulation, renderer, lesson route, and rich-package checks after
  scoped fixes: 12 files, 84/84. The final `SpaceVisuals` regression is 7/7.
- Full frontend Vitest after all Gravity fixes: 150 files, 844/844.
- Isolated real-app Playwright: 2/2, desktop 1440×1050 and mobile 390×844,
  both with reduced motion. It covers both prediction gates and feedback paths,
  keyboard scrubbing, paused motion, 50 m/Mars/20 kg boundaries, dynamic plot
  scale, reset, no per-frame live region, WebGL fallback, horizontal overflow,
  and mobile fixed-navigation clearance. No production request or write occurs.
- Rich package regression: 12/12, including both hidden-until-predicted actions,
  both feedback paths, mass-independent fall time, and distinct weight.
- Native Gravity/detail integration: 2 suites, 20/20. Native full unit run:
  32 files, 296/296. A prior broader native UI run had 529 passing tests and
  two failures; targeted reruns passed the changed Gravity suites (20/20) and
  the unrelated Family Tree suite (15/15).
- Native offline-scene freshness and TypeScript: passed. Generated scene size
  is 1,824,535 bytes; the unchanged SVG atlas is 1,030,560 bytes.
- Native offline browser verification in sandboxed Chromium as an unprivileged
  test user: 26/26. Gravity renders and updates with zero remote requests; all
  74 bounded SVG states also pass. This is a Chromium document test, not a
  physical Android/iOS WebView test.
- Frontend ESLint: passed with zero warnings. Production TypeScript/Vite build:
  passed; only existing Zod annotation and large-chunk warnings were emitted.
- Backend catalog: 7/7. Rich-package validation/security: 9/9. Module
  validation: 2 files, 10/10. Security backport/upstream: 4/4.
- Strict architecture report: zero boundary violations; existing unrelated
  hotspot notices remain.
- Rich package `gravity-package` version `1.0.1`: generated worker 386,345
  bytes; package build and backend validation passed. Deterministic archive:
  `/tmp/gravity-package-1.0.1.zip`, SHA-256
  `89934db5634ff07431141343660266a38bd5e414ad95cbac252d0cd75b1b7880`.

No Gravity-specific baseline/preflight script exists in the repository. The
architecture/change standards, module checks, package validators, freshness
checks, lint, build, unit, isolated browser, security, and architecture gates
above were used instead.

The full shared gate passed 27 files and 282 tests, but its unrelated Family
Tree Python producer import timed out and also timed out in isolation with one
worker. No Family Tree code changed. The affected Gravity and Family Tree
frontend suites both pass in their targeted reruns, and the final complete
frontend run is 844/844.

## Rendered review and media

Original, final, operated, boundary, paused-motion, fallback, and ordinary
mobile-scroll images were inspected directly, with the original Gravity
baseline and the accepted Orbit central art as references. The final central
art preserves the twin dimensional towers while improving the scene hierarchy,
lighting, landing geometry, and force-direction cues. The learning layer now
adds two real investigations and persistent evidence without obscuring the art.

Final capture root:

```text
/tmp/ui-captures/exploration-series-gravity/2026-11-01/after-v4/
```

Staged review media:

```text
/root/.openclaw/workspace/media/exploration-series/gravity/
  original/      four original desktop/mobile full and component images
  after/         initial, mass, world, boundary, fallback, and scroll evidence
  comparisons/   labeled original-versus-redesign desktop/mobile components
  finals/        central art and operated Earth–Moon apparatus
  motion/        paused in-flight desktop/mobile proof
```

The fixed bottom navigation appears mid-page in stitched full-page/component
mobile screenshots because a fixed viewport element is composited into the
tall capture. The separate ordinary-scroll screenshot and browser geometry
assertion show the feedback and controls can be positioned fully above it.

## Remaining device and parity gaps

- No physical Android/iOS device or real screen-reader session was run.
- Native and package artwork intentionally differ in composition and controls
  from the web scene; only the physics, investigation gates, outcomes, model
  boundary, and offline behavior are claimed equivalent.
- The rich package has no separate desktop/mobile responsive screenshot set in
  this checkpoint; its 3D and lesson behavior are covered by package tests.

Solar System Explorer remains pending explicit parent dispatch. The overall
26-Exploration series remains open.
