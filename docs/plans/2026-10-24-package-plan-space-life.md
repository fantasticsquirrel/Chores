# Space and life exploration package migration plan

Status: all six package-owned source ports implemented and locally verified on 2026-10-24. The original inventory below records requirements; the completion evidence and remaining integration scope are recorded at the end.

## Architectural boundary

Packages own domain-specific geometry, assets, simulation mathematics, control behavior, lesson questions, observation and feedback. The host owns only bounded generic rendering, input routing, accessible controls, authenticated asset delivery and isolated execution. Preserve legacy worker contracts. No topic-specific application renderer dispatch or wrapper substitution qualifies as conversion. Follow architecture-and-change-standards.md and discovery-content-standard.md.

## Per-topic inventory and implementation

### Orbit Workshop

Sources: `frontend/src/features/discovery-lab/simulations/OrbitSimulation.tsx`, `space/orbitScene.ts`, `space/spaceMaterials.ts`, `space/spaceModels.ts`, `physics.ts`.

- Preserve NASA Blue Marble 2k Earth texture, atmospheric shell, 420 stars, detailed satellite body, solar panels/cell dividers and antenna, full trajectory and traveled segment, gravity and velocity arrows. Preserve dynamic framing around entire trajectory and mobile view.
- Preserve velocity-Verlet integrator with dt 0.008, 2400 iterations, every-fifth-step samples, planet radius 0.22 starting radii and radius-6 cutoff. Escape threshold is sqrt(2\*mass); baseline speed does not renormalize when mass changes.
- Controls: launch speed 0–1.8 in .02 increments; central mass .5–2 in .1 increments; trace-position percentage; play/pause/reset; .60,1,1.42 presets. Parameter edits reset flight, drag scrubs progress, playback stops at end.
- Preserve lower-speed prediction and collision test, escape follow-up investigation and causal explanation. Readouts: outcome, distance, local relative gravity, escape threshold. Keep two-body/no-air and enlarged probe/direction-only arrow caveats and NASA attribution.
- Port pure mathematics, materials and scene construction into package, not application scene adapter.

### Gravity Drop Lab

Sources: `GravitySimulation.tsx`, `space/gravityScene.ts`, `space/spaceModels.ts`, `physics.ts`.

- Preserve twin detailed glass/brass towers, nuts, rails, 21 graduation ticks each, platforms, same-sized spheres and moving shadows. No external assets.
- Exact model: fall time sqrt(2h/g), impact speed sqrt(2hg), distance min(h,gt²/2), weight mg. Earth reference 1kg and g9.81; comparison worlds Earth9.81/Moon1.62/Mars3.71/Jupiter24.79.
- Controls: world selector, height5–50m, mass1–20kg, timeline/play/pause/reset and horizontal scrubbing.
- Preserve mass prediction/test, equal elapsed-time Moon comparison, numerical landing/height/status, weight-versus-mass causal explanation. Jupiter is cloud-top gravity, not a solid surface; constant gravity/vacuum and schematic tower scaling caveats remain.

### Solar System Explorer

Sources: `SolarSystemSimulation.tsx`, `space/solarScene.ts`, `space/spaceMaterials.ts`, `space/spaceModels.ts`.

- Preserve all eight planetary surfaces, NASA Earth map, deterministic 1024x512 authored textures (including Jupiter storm), Saturn ring bands and gap, Uranus tilt, Earth atmospheric shell, stars, eight circular orbit paths, selected-planet marker and independent closeup.
- Preserve true common-diameter-scale Earth/comparison view as a distinct mode. Orbital view radii are intentionally schematic. Portrait view stacks closeup and orbit map; rings must not clip.
- Preserve table of rounded AU distances, periods and diameters and planetAngle = years/period*2π + index*.8. One timeline cycle is10 Earth years.
- Controls: eight shortcut buttons and selector, view selector, speed1–10, timeline, play/pause/reset, horizontal scrubbing.
- Preserve one-Earth-year Earth/Neptune prediction/test and Jupiter diameter comparison (11.21 Earth diameters). Readouts distinguish distance, period, elapsed years and diameter. Keep illustrative surfaces, circular/copanar paths, non-current positions, unequal scales, rings excluded from diameter and source attribution.
- Pre-bake authored surface pixels as package-owned images rather than executing canvas code in worker.

### Moon Phase Observatory

Sources: `MoonSimulation.tsx`, `moon/MoonCanvas.tsx`, `packages/discovery-scenes/src/moon.ts`, `CelestialArt.tsx` (inset Earth).

- Copy exact assets `moon/assets/lroc-color-2k.jpg`, `lola-elevation-1k.jpg`, and source credits. Preserve sphere radius1.24 with128x96 segments, rotationY -π/2, bump .025, roughness1, moving white directional light intensity3.4 and faint ambient .025. Perspective camera fov32 at[0,0,5.4].
- Preserve orbit inset Earth/Moon, dashed orbit and sunlight arrows; not a replacement for textured physically illuminated sphere.
- Controls: angle0–359, new/quarter/full/last-quarter presets, play/pause/reset, horizontal drag .65 degrees/pixel. Cycle29.5 days, initial90°.
- Exact visible illuminated fraction (1-cosθ)/2 and eight phase labels. Preserve25/50/75 prediction, first-quarter test with prediction-specific feedback and opposite-half comparison90/270.
- Preserve phases-not-Earth-shadow explanation, synodic cycle distinction, fixed Earth orientation/location caveat, faint reflected light, omitted inclination/eclipses. Texture load failure must not remove controls or numerical evidence.

### Leaf Energy Lab

Sources: `PhotosynthesisSimulation.tsx`, `botany/createLeafScene.ts`, `botany/LeafCanvas.tsx`, `physics.ts`.

- Preserve bezier leaf blade and branched vein tubes, magnified upper/lower epidermis,12 capsule palisade cells with72 chloroplasts,10 spongy cells, paired guard cells/stoma, separate water/sugar vascular tubes, light rays, carbon dioxide/oxygen particles, plinth and four leader-line callouts. No external files.
- Perspective camera fov34 at[7,5.3,9] looking[0,.5,0]. Preserve responsive framing and label readability, not merely generic green blobs.
- Exact resource model min(light,water,carbon) and rate100\*min/(min+25); stable tie order. Light changes illumination/ray count; water changes leaf color and tube opacity; activity changes chloroplast emissive intensity and oxygen count; carbon changes input particles.
- Controls all three0–100, save comparison and reset70/60/80; saved result and signed delta. Package owns saved state.
- Preserve zero-water/high-light investigation and switch-of-limiting-resource comparison, process equation, transport legend and accessible result. Caveats: illustrative relative activity, not growth prediction; temperature/species/nutrients held constant; respiration continues day/night; layers/organelles not common scale.

### Light Bending Studio

Sources: `OpticsSimulation.tsx`, `optics/OpticsBench.tsx`, `physics.ts`.

- Preserve rich top-down vector instrument: graded metallic table and laser, drilled-hole pattern, concentric instrument face,72 graduation ticks,12 numerical angle labels, translucent glass half disk, dashed normal, layered ray glow, reflection/refraction angle arcs and draggable source.
- Exact Snell model sine=(n1/n2)\*sinθ, TIR iff sine>1, no reflected branch at equal indices. Angles measured from normal, not surface.
- Controls angle0–80; n1/n2 1–2 in.01 increments; swap materials; reset40°,1,1.5; pointer drag clamps atan2 normal-relative angle.
- Preserve critical-angle glass-to-air investigation and lower-to-higher/equal-index comparisons, reflection/refraction/TIR evidence, Snell equation and material benchmarks. Ray brightness is not calculated energy split.
- Need bounded declarative vector paint/path/transforms, never raw SVG/HTML or arbitrary URLs.

## Generic contract requirements

- Geometries: sphere, plane, ring, capsule, Catmull-Rom tube, bezier shape and bevel extrusion; open-ended cylinder; point cloud stars; all bounded counts/parameters. Bounded precomputed mesh buffers are an alternative preserving shape.
- Materials: standard/basic/line/dashed/points and physical glass; emissive/intensity, side, depthWrite, transparency/opacity; texture map/bumpMap from verified local package assets only.
- Cameras: perspective and orthographic, exact positions/targets and adaptive framing. Ambient light and changing directional lights.
- Animation: worker frames for3D packages, no topic code in host; ensure avoid unbounded renderer resource churn. Pointer-to-worker/control events with capture/cancel. Host exposes accessible slider alternatives.
  -2D: validated path commands/arcs, ellipses, gradients, patterns, transform groups, opacity, stroke widths/dashes; no raw SVG.
- Capacity: existing12 buttons insufficient for eight Solar shortcuts plus playback/prediction/trial. Measure payload and shape count against current256/64KB cap for Optics; do not silently strip detail. Image assets kept outside recurring frame payloads.
- Labels: projected3D anchor plus optional screen-percentage target and leader line for leaf callouts.

## Verification matrix

For every package: execute built worker in isolated VM; pass output through real boundary parser at defaults, all controls and representative extrema; compare original model outputs; verify reset/pause/prediction/save behavior, all required content/caveats and asset integrity; scan package dependency graph for application imports, network/DOM access and renderer wrappers.

- Orbit:.6 collision,1 circular,1.42 escape; changing central mass preserves baseline speed and finite trajectory; arrows/path progress/framing.
- Gravity: mass invariance of acceleration/time/size; weight changes; world comparison; simultaneous release; clamped landing.
- Solar: all eight planets, both views, Saturn rings,11.21 Jupiter diameter ratio,1/165 Neptune orbit per Earth year; mobile stack.
- Moon:0/90/180/270 texture lighting and fraction/phase; both quarter orientations; asset load and context-loss fallback; prediction/reset.
- Leaf: each resource zero, limiting ties, limiting-resource crossover, saved comparison/reset; tissue detail and labels at mobile sizes.
- Optics: normal incidence, equal indices, both travel directions, critical-angle boundary, TIR ray suppression, source drag/cancel and swap/reset.
- Mobile/browser: screenshot default and boundary states at320/390px and desktop; no clipped sphere/rings/towers/labels or inaccessible controls; keyboard and touch sliders; WebGL/context loss retains meaningful evidence.
- Security: image type/size/hash/local path validation; reject URL/traversal references, oversized buffers, malformed geometry, nonfinite input, unknown attributes; existing worker sandbox/auth/CSRF/access boundaries remain authoritative.

Existing characterizations to retain: `space/spaceModels.test.ts`, `space/createSpaceScene.test.ts`, `space/SpaceVisuals.test.tsx`, `optics/OpticsBench.test.tsx`, `frontend/e2e/discovery-moon-exemplar.spec.ts`, native scene integration tests. Run targeted tests first, then adjacent/full frontend/mobile/backend gates and diff check. Do not claim screenshots/editorial/asset-source verification until actually performed.

## Completed source and verification evidence (2026-10-24)

- Implemented independent `worker-rich-v1` author packages for `orbital-mechanics`, `gravity`, `solar-system`, `moon-phases`, `photosynthesis` and `reflection-refraction`. No worker imports an application simulation/renderer. Actual package geometry, source mathematics, lesson state, prediction feedback, reset/playback/drag controls, immutable raster assets and source credits are package-owned.
- The shared author serializer and generic host retain primitive/full-buffer geometry, original material/light/camera settings, image/bump maps and bounded reusable resource frames. Perspective/orthographic cameras and package-authored responsive heights/insets preserve original framing. A separate outer viewport width prevents inset-dependent breakpoint oscillation.
- Preserved the complete Optics vector instrument and exact Earth-globe Moon inset through a bounded declarative vector recorder/renderer. The trust boundary rejects executable tags/props/styles, external references, malformed/budget-exceeding content, excessive composed affine transforms, cyclic paint/clip dependencies and unbounded filters. Only narrowly bounded local drop shadows are supported.
- Restored information hierarchy with elapsed/radius/phase/diameter statistics and grouped numerical readouts. Gravity explicitly requests paired columns. Leaf callouts retain leader lines and wrap on narrow displays. Leaf's original vector fallback is packaged for WebGL failure; Moon's orbit diagram and all numerical controls remain independent of WebGL.
- Preserved source drag behavior. Fixed cameras prevent a learner rotating the Moon away from the Earth view while the phase calculation still assumes Earth. Prediction feedback is invalidated when later manual input changes the tested observation.

### Automated verification

- `frontend/src/features/discovery-lab/packages/rich/spaceLifePackages.test.ts`: all six workers compile/run without browser or network globals; defaults, every control endpoint and every button pass the real rich boundary. Characterization checks cover collision/escape/mass baseline, gravity mass invariance, all eight planet shortcuts and Jupiter ratio, four Moon quadratures, limiting resources/saved trials and equal-index/TIR Optics behavior.
- `vector.test.tsx` and the independent `securityReview.test.ts`: 24 combined source/vector/security tests passed. `scripts/exploration-packages/shared/education-regressions.test.ts`: six cross-collection regression tests passed, including changed-observation Moon/Leaf feedback.
- Frontend TypeScript, scoped ESLint (zero warnings), Prettier for all owned author sources and `git diff --check` passed.

### Matched real-browser review

A local Chromium harness renders the original React simulations and independent package frames through the real generic Three/vector renderer, with original styles and immutable image assets. It is not a replacement for the parent task's authenticated installation/update/rollback suite.

- 24 matched configurations (six topics × desktop/mobile × default/alternate), 48 stage screenshots and full-package captures were generated and visually inspected. No page errors or document overflow occurred. Desktop viewport: 1100×1100; mobile viewport: 390×844.
- Orbit: baseline circular path and escaping probe, full satellite detail, force/motion direction and original adaptive framing.
- Gravity: both apparatuses, equal release and Moon comparison at equal elapsed time, unchanged sphere size and landing state.
- Solar: original desktop split and portrait stack, Earth close-up, eight-body orrery and Jupiter common-diameter comparison. Additional Saturn diameter-view screenshots check full rings on desktop and portrait.
- Moon: first-quarter/full illumination, retained LROC/LOLA surface detail, correct terminator, complete Earth/orbit/sunlight inset and fixed Earth camera.
- Leaf: full anatomical section/veins/cells/chloroplasts/stoma/transport particles, water-zero response and legible mobile leader labels. The package uses host readouts/footnotes for process/transport legends rather than copying the original CSS-bound footer.
- Optics: full graded instrument/protractor/laser/glass artwork, refraction and total internal reflection; no simplified schematic replacement.
- Real pointer dispatch through generic views and independent workers passed on a mobile viewport: Orbit/Gravity/Solar progress 0→15%, Moon90°→139.18°, Optics40°→60°. Source-locked cameras expose no orbit controls.

Evidence is under the task deliverables directory `space-package-proof`: per-topic `*-comparison.png`, `render-review.json`, `pointer-review.json`, `saturn-review.json` and original/package PNGs. These are engineering review artifacts, not external hosting URLs.

Remaining integration scope belongs to the parent collection migration: authenticated upload/publish/access/version update/rollback of all packages, aggregate gates and native-app integration. This source review does not claim a physical-device native screenshot run or deployment.
