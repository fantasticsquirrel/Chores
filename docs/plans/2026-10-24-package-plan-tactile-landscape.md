# Independent package conversion: physical, tactile and landscape topics

Status: source inventory complete; implementation awaits the bounded rich-runtime contract. This plan covers ten existing explorations. Bundled web/native experiences stay available and unchanged. Downloadable packages remain explicitly web-only until a native package renderer exists; mobile-web verification is not native parity.

## Non-negotiable conversion boundary

Copy topic geometry, deterministic calculations, procedural assets and teaching content into each package's authoring directory. A package must not dispatch a scene name into bundled app code. Its generated worker and manifest must independently contain its visual/model implementation. Preserve original detail, controlled comparisons and meaningful interactions; do not substitute generic icons or numeric controls for the actual visual. Package builds may use authoring dependencies, but installed packages cannot import dependencies or execute on the host main thread.

## Inventory and port plan

### Sound Playground

- Renderer: `simulations/physical-exhibits/soundScene.ts`, `sceneGeometry.ts`; `SoundDrawing.tsx` fallback and pressure trace in `SoundPlaygroundSimulation.tsx`. Preserve wooden monochord body, moving bridge, screws, tuner, vibrating tube string and dashed resting line.
- Assets: procedural meshes/materials, no external image. Pressure curve is schematic SVG. `useStringAudio.ts` supplies user-gesture-only sine audio, 850 ms maximum with low gain and reset/unmount stop.
- State/actions: length 20–120 cm, tension 20–200 N, amplitude 0–8 mm, cycle position, playback/pluck, double length/amplitude, audio and reset. Doubling must preserve other inputs and respect bounds.
- Model: copy `stringWave`: f=sqrt(T/0.001)/(2L), air wavelength=343/f; relative energy=A² only for fixed L/T. String wavelength and air wavelength are different; slowed motion is not audio frequency.
- Investigations: predict/test doubling length at fixed tension/amplitude; reset and double amplitude at fixed length/tension. Evidence must include frequency, pressure cycles, amplitude and energy, not just moving string.
- Runtime: tube paths, animation timing/explicit step, supplementary vector trace, optional bounded trusted audio effect. Without audio support document loss, never claim full interaction parity.
- Tests: f halves with doubled L, independent of A; energy quadruples with doubled A; zero amplitude silence; reset stops playback/audio; mobile phase, pluck and audio controls remain reachable.

### Bridge Builder

- Renderer: `physical-exhibits/bridgeScene.ts` and `BridgeDrawing.tsx`. Preserve river valley/banks, trees/rocks, four beam sections, diagonal reinforcement, truck, support/load arrows and utilization coloring.
- Assets: procedural geometry only; tubes/rods, cones, dodecahedra and quaternion rod alignment.
- State/actions: timber/steel, four independent braces, load 0–30 kN, position 5–95%, left/center/right shortcuts, reset. Keep each brace independently selectable using accessible controls.
- Model: copy `bridge`: 10 m simply-supported beam, support reactions sum to load, bending moment at load, four zone maxima; illustrative capacities 16/45, brace factor 2.4, material/brace credit cost.
- Investigations: move same load left and compare reactions; hold truck/load/material fixed and reinforce the highest-utilization zone. Explicitly not solved truss mechanics or construction safety.
- Tests: zero load; reaction conservation/symmetry; position extremes; reinforcement affects capacity/cost not applied force; mobile controls and exact four-zone evidence.

### River Sculptor

- Renderer: `packages/discovery-scenes/src/landscape/river.ts` plus `geometry.ts`. Preserve 81×81 colored terrain, geological skirt, sinuous channel, water/flood ribbons, rain marks, sediment grains and vegetation. No terrain flattening or generic scene substitute.
- State/actions: slope 1–20%, rain 0–100 mm, vegetation 0–100%; one storm, restore soil only, full reset. History retains storms, remaining/deposited/exported soil; pale water previews the next storm.
- Model: copy `riverStorm`: 1 ha, 1-hour storm, rainfall volume ×10, infiltration/runoff split, available-soil clamp, deposited+exported=eroded, 180 m³ channel capacity; invented coefficients, not forecasts.
- Investigations: bare versus 100% vegetation at fixed rain/slope and restored soil; slopes 2% versus 20% at rain40/vegetation40, restored soil. Runoff does not depend on slope in this model.
- Tests: soil mass conservation across repeated storms, nonnegative finite soil, zero rain, exhausted soil; restore preserves environment controls; reset restores defaults; camera orbit/zoom/above view and mobile labels.

### Circuit City

- Renderer: `physical-exhibits/circuitScene.ts`, `CircuitDrawing.tsx`. Preserve three houses/roofs, window power glow, battery terminals, wires, independent switch levers and conventional-current arrows. Materials require color/emissive updates.
- State/actions: series/parallel, voltage 0–18 V, three switches, reset.
- Model: copy `circuit`: each load 12Ω, V/R, per-house voltage/current/power, source power; ideal DC supply. Charge is conserved while energy transfers, not mains-wiring advice.
- Investigations: open house2 in series then parallel without changing supply/switches; compare voltage at fixed topology/switches and observe current/power. Show branch-current sum and zero-current open paths.
- Tests: zero supply, every open/closed switch permutation, series interruption versus parallel isolation; battery sum conservation, glow consistent with power; keyboard/mobile switches.

### Food Web Rescue

- Renderer: `landscape/pond.ts`; trend chart `landscape/PondTrend.tsx`. Preserve pond cutaway, changing water level, algae/grazers/fish, oxygen symbols and relative-scale labels.
- State/actions: nutrients0–100, drought0–100%, each species remove/restore, advance week, reset; retain last21 population/oxygen states. Species changes edit current history point, not an extra elapsed week.
- Model: copy `initialPond` and `pondWeek` with ten bounded substeps per illustrative week, grazing/predation/oxygen stress. Three-group chain, indices not measured counts; drought scene preview versus time-dependent biology.
- Investigations: fish absent versus present after five equal weeks at nutrients50/drought0; nutrients20 versus100 after five equal weeks and reset between trials. More nutrients need not benefit all populations.
- Tests: extinction remains zero until restore, bounded indices, equal elapsed-step comparisons, chart/current-state agreement, mobile labels and chart evidence available as text.

### Fraction Feast

- Renderer: `tactile/pizzaScene.ts`, `tableGeometry.ts`, `TableCanvas.tsx`; `FractionArt.tsx` fallback. Preserve equal-size plate/pizza wholes, individually chosen/exploded sectors, crust, toppings and combined amount display. Assets are Canvas-generated crust/cheese/number textures.
- State/actions: active plate, numerator/denominator, exact slice selections, tap slice (not only numerator slider), split pieces preserving selection/amount, combine, prediction and reset. Selection must support plate+slice identity and keyboard/button equivalent.
- Model: copy `addFractions` and `simplifyFraction`; compare cross-products. Equal whole size/equal pieces matter; sums may exceed1.
- Investigations: predict equal amount from1/2 versus2/4 and split a chosen plate; combine unlike denominators and explain common units. Preserve two-whole result when necessary.
- Runtime: shape/extrude/torus arcs, transparent hit geometry, per-node action IDs, texture assets or full author-side canvas generation, line segments/edges. Existing 64-material cap requires deduplication rather than dropping toppings.
- Tests: sparse slice selection preserved under split, split denominator bound24, numerator never exceeds denominator, sum >1, equivalent fractions, mobile tap versus orbit distinction.

### Pattern Palace

- Renderer: `tactile/PatternWorkbench.tsx` is rich SVG, not Three. Preserve regular polygon corner arrangement, gap/overlap sectors, asymmetric colored motif/red marker, transformed motif and repeated band.
- Assets: authored SVG paths and palette, no downloaded images.
- State/actions: sides3–6, copies1–6, rotation in15° increments/quarter-turn shortcut, reflection, repeats, prediction, reset.
- Model: copy `vertexFit`, `regularTile`, `transformPoint`; angle=(n−2)180/n, occupied sum; reflection is applied before rotation as in existing model.
- Investigations: compare pentagons versus squares at a corner; rotate/reflect asymmetric motif and explain marker displacement with unchanged lengths/angles. A360° corner alone does not prove a global tiling.
- Runtime: faithful bounded vector paths/polygons/transforms or package-owned mesh equivalent, not a static screenshot. Vector output cap must accommodate repeated band.
- Tests: three pentagons leave36° gap; four squares fit360°; excess copies overlap; transformed marker exact; lengths preserved; mobile legibility and no clipped band.

### Caravan Crossroads

- Renderer: `landscape/caravan.ts` and geometry helpers. Preserve colored relief, mountains, oasis, river, markets and each selected route/cargo caravan.
- Assets: procedural meshes/materials only.
- State/actions: ridge/river/oasis, wet/dry, grain/cloth/pottery, cargo units, supply days, pack-enough action, reset.
- Model: copy route/cargo constants and `caravanJourney`; 100kg limit, supplies2kg/day, round-up spoilage/breakage, toll/cost/revenue/margin and viability. Entire map/economics fictional; trade networks multidirectional.
- Investigations: same six grain units/river road in wet versus dry, enough supplies each; six pottery units in dry season via ridge versus oasis, enough supplies each.
- Tests: exact capacity threshold, supply shortfall, grain ten-day threshold, pottery ridge losses, route changes do not silently fix supplies except explicit action; labels and mobile selectors.

### Pollinator Express

- Renderer: `landscape/garden.ts`; preserve two patches, nest, bee, visible pollen, reach ring, path, compatible-receiver indicators and added habitat. Flowers are scene-selectable via userData.select today.
- State/actions: reach80–240 in10 garden-unit steps; habitat toggle starts new journey; select flower by hit target or accessible button; return-to-nest versus full reset. Preserve visits, transfers, current pollen/source, received IDs and path.
- Model: copy flower coordinates, `initialPollinator`, `visitFlower`; range from current position, only different same-species flowers receive compatible pollen; one-load assumption. Transfer is not fertilization/seeds.
- Investigations: at170 reach compare Gold1→Gold2→Gold3 versus added Gold bridge; compare Gold1→Gold2 with Gold1→Violet1, nest reset between.
- Tests: unreachable target doesn't teleport; exact reach boundary; self/incompatible transfer rejected; habitat reset, nest reset control semantics; mobile flower hit targets distinguish click from camera drag.

### Chance Carnival

- Renderer: `tactile/chanceScene.ts`, `tableGeometry.ts`; `ChanceArt.tsx` distribution chart. Preserve weighted spinner sector sizes, pointer on actual last outcome, rounded die with correctly oriented face/pips and observed-versus-theoretical bars.
- Assets: generated number/pip textures and tactile materials, no downloaded image.
- State/actions: four-outcome spinner/six-outcome die, selected outcome weight, trial batch, one/batch run, clear sample, predictions/reset. Weight/mode changes clear incompatible sample history. Zero total weight disables draws.
- Model: copy `probabilities`, `sampleOutcomes`, `fairnessDistance`; inject seeded RNG in tests only. Preserve last actual draw separately from earlier batch. Independence forbids overdue-outcome claim; increasing sample need not improve monotonically.
- Investigations: predict uneven counts with equal chances and compare small/larger samples; change one weight then compare its theoretical chance with a fresh sample.
- Tests: all-zero/no draw, zero-weight outcomes absent, counts sum to trials, deterministic seeded boundaries, last outcome equals sampled outcome, mode/weight resets, mobile selected-weight control and accessible distribution.

## Shared capability requirements and proposed safe implementation

The Castle proof supports bounded primitives but not the actual above scenes. Coordinate an explicit new capability rather than silently extending Castle's allowlist. A package-side, tree-shaken Three authoring layer can generate bounded position/normal/color/UV/index buffers; host validates each array and aggregate vertex/index/triangle budgets before constructing trusted geometry. Serialize final scene data only, never ObjectLoader JSON, callbacks, shaders, URLs or arbitrary property bags. Deduplicate material/geometry resources before output; count worst-case states before setting ceilings. The 81×81 terrain alone means the Castle524k-character response budget cannot be assumed sufficient. Preserve heightfield resolution, use a bounded heightfield primitive or a measured larger budget.

Additional explicit needs: normalized quaternion transforms; sphere/cone/dodecahedron/rounded-box/tube/shape geometry or their validated buffers; side/depthWrite/emissive/vertex-color materials; safe immutable package-local image texture assets; bounded node selection action IDs with accessible equivalents; supplementary charts/vector paths; demand/controlled animation and user-gesture-only bounded audio if parity requires it. Rich output must continue watchdog/lifecycle enforcement, finite-value validation, resource disposal and no network/session access.

## Verification sequence

1. Characterize package model functions against existing math tests before changing behavior.
2. Build each independent worker and execute init, all controls, all guided actions and reset in a worker harness. Reject app-relative imports/scene-dispatch wrappers; verify digest and manifest runtime.
3. Validate every resulting scene with the actual host parser, including all extrema, high-object-count states, sample/history bounds and terrain payload size. Record maximum bytes/materials/vertices/triangles.
4. Add selection/control/reset regression tests, including fair comparison state and bounded animation/audio lifecycle.
5. Build and validate all ten ZIPs with package tooling. Old Castle package/tests remain unchanged and passing.
6. Render browser screenshots at desktop and narrow touch width; compare against original scenes for missing geometry, textures, evidence, labels and controls. Exercise drag versus tap, arrows, zoom and Home.
7. Check WebGL unavailable/worker failure are explicit and still provide meaningful textual evidence; do not call unavailable rendering visual parity.
8. Editorial review both guided investigations and caveats in rendered UI; reopen primary sources from the registry and record exact claim support. Inventory alone is not completed editorial/source review.
9. Run targeted frontend/shared/backend package tests, lint/typecheck/build; verify original native explorations remain unaffected. Record native downloadable support as unavailable, not passed.

No deployment or push is authorized for this work slice. Package publishing/child approval remains a separate explicit task.
