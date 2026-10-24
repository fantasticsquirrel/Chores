# Orbit, solar system and gravity visual revision

Status: implemented and locally verified; collection-wide and user visual approval remain pending. No remote deployment or repository publication was performed.

## Rendered implementation

- Orbit: material-lit Earth and modeled satellite, perspective path and directional gravity/motion arrows. Collision and escape still use the unchanged `physics.ts` trace. Mobile camera looks more nearly down on the orbit, preserving legibility without changing coordinates. Planet radius remains 0.22 of initial distance; the probe is enlarged.
- Solar system: all eight moving bodies, selectable close-up and true diameter comparison. Orbit gaps/planet display sizes are expressly schematic, but angular motion uses each planet's existing period. Diameter comparison uses one scale. NASA Earth map is local; other surfaces are procedural illustrations.
- Gravity: two lit glass-and-metal drop tubes. Earth reference remains 1 kg and 9.81 m/s²; comparison world and mass are independent. Mass affects weight, not fall acceleration. Floor clamping is explicit.
- Labels and numerical results are HTML, not shrinking canvas text. Each simulation has prediction choices, a controlled test, observation feedback and a causal explanation, plus the existing second investigation. No branded eyebrow or decorative tagline was added.
- The React renderer is lazy-loaded. DPR is capped at 1.5. Frames are requested only on state/size/asset changes and skipped offscreen or with the document hidden. Motion is opt-in and pausable; manual scrub remains available under reduced motion. All geometry, materials, textures, listeners and renderer resources are disposed. Shared planet textures avoid duplicating GPU maps between views.

## Checks

- 10 tests in `space/` pass, covering eight planets, relative periods, bounded collision/escape framing, fall-floor clamping, mass/weight invariants, fair comparisons, control output, renderer pixel ratio, coalesced demand frames and GPU disposal.
- Adjacent `ExplorationSimulation.test.tsx`: 19 passed on the final functional pass. Together: 29 passed.
- Focused ESLint passed for these three components and all `space/` files. TypeScript passed after these changes; a later concurrent aggregate run was blocked only by another worker's unfinished landscape imports. Re-run the aggregate gate after all workers finish.
- Actual Chromium (`/tmp/chromium`) component previews tested at 1166px and 390px, reduced motion enabled. All six views rendered WebGL, started paused and had no horizontal overflow or page errors. Tested orbit speed/mass effects, direct pointer scrub, finite collision, one-year solar comparison, true-size Jupiter mode, equal-acceleration mass comparison and play/pause. Forced non-WebGL fallback retained functioning controls and numerical output.
- Captures and browser log are in the coordinated evidence directory, not shipped application files. The local Vite-only visual test harness was moved out of the repository after capture; no temporary preview files remain in the production tree. Real lesson routes remain `/chore/discovery-lab/orbital-mechanics`, `/chore/discovery-lab/solar-system`, and `/chore/discovery-lab/gravity`.

## Native integration seam

The React-free builders accept `SceneContext` and return `update`/`resize`; `createSpaceScene` owns WebGL lifetime. Orbit accepts authoritative trajectory points/progress. Gravity optionally accepts reference gravity/mass and precomputed reference/comparison distances. Solar optionally accepts eight precomputed angles in radians. The native worker is integrating these same source builders into an offline WebView transport. This does not claim native device or visual parity verification.

## Remaining scope

Full authenticated-route screenshots, collection-wide aggregate gates and native device captures belong to the parent integration pass. The non-WebGL fallback is textual, with complete controls/results, rather than visually equivalent 3D. Surface materials and apparatus are teaching illustrations, not a physical spacecraft/laboratory reconstruction. Asset provenance and NASA usage terms are in `assets/SOURCES.md`.
