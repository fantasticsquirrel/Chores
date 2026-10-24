# Ten physical, tactile and landscape package conversions

Verified on 2026-10-24. These independent package author sources cover Sound Playground, Bridge Builder, River Sculptor, Circuit City, Food Web Rescue, Fraction Feast, Pattern Palace, Caravan Crossroads, Pollinator Express and Chance Carnival. Original bundled web/native implementations remain unchanged by this slice. Downloadable packages are explicitly web-only; mobile evidence below means mobile web, not native package playback.

## Ownership and fidelity

Each topic directory under `scripts/exploration-packages/` contains its own complete copied geometry/artwork, deterministic model and worker lesson state. No worker dispatches a built-in scene ID or imports the bundled app's topic implementation. Common author helpers serialize generic Three resources and lighting, but do not contain topic geometry or calculations. All workers are built into self-contained artifacts by the master builder.

The shared serializer preserves primitive parameters only after comparing every attribute and index against a pristine reconstruction. Modified terrain and other altered primitives remain bounded buffers. Quaternions become equivalent XYZ Euler transforms. Draw ranges, material-array geometry groups, colors, maps, texture transforms, lights and camera orientation are preserved. Material/geometry content is deduplicated. Raster artwork is generated from package-owned original procedural functions and shipped immutably, not drawn by untrusted DOM code.

The terrain grid remains the original 81×81 vertices. Food textures, crust, all toppings, numbered slices, rounded die/pips, asymmetric mosaic motif, river sediment, relief markets, flowers, switches, bridge sections and monochord hardware remain authored detail, not generic substitutes.

## Bugs found and corrected during verification

- Fraction 24 selected slices initially expanded exact shape buffers beyond the 4 MiB response ceiling. The generic rich contract gained bounded Shape/Extrude commands with original curve resolution; the serializer verifies pristine geometry before using them. A full 24-slice plate plus the other default plate fell from 8.63 MB to 108 KB. Both full 24-slice plates are 120 KB. This is transport compression, not reduced tessellation.
- Fraction stale slice selection could exceed a newly reduced denominator. Active/denominator changes clamp selection and slice actions validate bounds.
- Fraction 16 pieces could previously split to 32 despite a 24-piece promise. The package accepts 16 from splitting 8 but prevents further splitting beyond 24.
- Fraction/Chance guided comparisons could run without their promised baseline. Both now require a baseline stage and invalidate it after relevant manual changes. Chance cannot accidentally compare 990 trials with a promised 1000.
- Chance distance feedback now calls the existing model with `(counts, weights)` and labels its result in percentage points.
- Pattern's original local drop-shadow filter and Georgia labels were initially rejected. Generic bounded vector support now admits only the required safe local filter and font variants; complete frame validation passes.
- Fraction mobile framing was increased to keep both vertically arranged plates visible in the generic stage, rather than clipping the lower plate.
- Sound retains user-click-only bounded audio, slowed playback, phase control and pressure trace. Its ruler drag captures the ruler once instead of repeatedly plucking while the pointer crosses other geometry.

## Automated evidence

Commands from repository root:

```sh
npx vitest run scripts/exploration-packages/shared/tactile-landscape-packages.test.ts --environment node --maxWorkers=1
npx vitest run scripts/exploration-packages/shared/serialize-scene.test.ts --environment node --maxWorkers=1
npx tsc --noEmit --strict --skipLibCheck --moduleResolution bundler --module esnext --target es2022 --jsx react-jsx $(find scripts/exploration-packages/{sound-playground,bridge-builder,river-sculptor,circuit-city,food-web-rescue,fraction-feast,pattern-palace,caravan-crossroads,pollinator-express,chance-carnival,shared} -name '*.ts' -o -name '*.tsx')
```

- Full worker/merged host-protocol suite: 28/28 passed in 142 seconds. Covers every topic's initial frame, each individual control endpoint, every initial action, reset, cumulative all-min and all-max controls, and all 64 pairs of supported pizza denominators with both numerators at their maximum. It also covers conservation, audio frequency/amplitude distinction, bounded probability samples, pollen compatibility, sparse-slice splitting, sums greater than one and guided baseline guards.
- Serializer suite: 7/7 passed. Includes byte-for-byte equality of reconstructed extrusion position/normal/UV arrays at 64 curve segments, modified-geometry buffer fallback, equivalent resource deduplication, material groups, draw ranges, texture asset ownership, line segments/points and hidden zero-scale geometry.
- An additional captured-ruler-drag regression passed after the 28-test run, bringing the authored suite to 29 tests. Strict TypeScript author check passes. It checks source scripts and JSX rather than relying on esbuild's transpilation or the application build, which does not otherwise typecheck these author directories.
- Independent generic-runtime reviewer also added separate education regressions. Those results are owned by the runtime verification, not silently counted as this suite.

The master task separately owns manifest/ZIP validation, built application tests, package upload/publish/child approval/update/rollback acceptance, backend/security gates and overall commits. This document does not claim those from author-harness results.

## Browser and editorial review

A real Chromium 153 browser rendered actual original React simulation components and the new generic rich renderer with actual package worker output. The browser stayed sandboxed. Captures covered all ten topics at 1100 px desktop and 390 px mobile, first defaults and then matched changed states: amplitude/phase, truck position, vegetation, parallel/open circuit, nutrient supply, split pizza, square corner fit, dry-season route, habitat patches and die mode. Original controls were operated, not just reconstructed from a guessed state. All 40 topic/state/viewport cases completed with zero page errors and zero horizontal overflow.

Four final Fraction/Pattern rerenders and two matched both-plates-full 24 captures also completed without page errors/overflow. Visual inspection confirmed the full 24 artwork and both mobile plates remained visible. Some locator-only canvas crops on mobile included neighboring page content due scroll clipping; full-component captures were used for those reviews, not the misleading crop.

Reviewed default and alternate image contact sheets for every topic: geometry, material colors, labels, route/flow directions, proportions, switch/house power state, bridge loading, selected fraction area, motif fit and die face were retained. Generic page/chrome layout is intentionally different; this is not a claim of pixel-identical page layout. Tactile Canvas artwork is generated at build time, so minor platform font rasterization differences are possible.

Reviewed worker lesson copy against the source model: both investigations specify predictions, executable baseline/comparison actions, observable evidence and explanation prompts. Significant assumptions remain visible. Pond includes both a trend vector and ordered numeric history. Sound includes a pressure trace and non-audio frequency/amplitude evidence. Chance includes theoretical versus observed bars/counts. Fractions retain exact arithmetic and a combined amount beyond one whole.

Supporting source links are inherited by the master manifest builder from the existing registry. No new external-source claims or images were added. Reopening every institutional source is not claimed by this conversion slice; the retained historical/scientific limitations were checked against the original models and content standard.

Reproduce browser harness generation and default/alternate captures with:

```sh
node scripts/exploration-packages/shared/visual-proof-build.mjs
DISCOVERY_BROWSER=/path/to/chromium PROOF_OUTPUT=/tmp/tactile-package-proof node scripts/exploration-packages/shared/visual-proof-run.mjs
DISCOVERY_BROWSER=/path/to/chromium PROOF_OUTPUT=/tmp/tactile-package-proof node scripts/exploration-packages/shared/visual-proof-alternate.mjs
```

The executed proof files were saved in the task's `deliverables/tactile-package-proof/` directory with JSON browser/error/overflow records. No production push or deployment was performed by this conversion worker.
