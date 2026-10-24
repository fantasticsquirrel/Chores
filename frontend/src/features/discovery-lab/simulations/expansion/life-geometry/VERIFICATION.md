# Cell, shape and adaptation implementation verification

Reviewed 2026-10-24 in `family-discovery-next-nine`. No frozen delivery worktree, backend, navigation, registry, native integration or remote destination was changed by this slice.

## Implemented learning relationships

- Cell Explorer: selectable plant/animal organelles plus a separate enlarged membrane diagram. Oxygen crosses the lipid boundary, glucose requires a carrier, and passive net transfer follows the concentration difference. Equal volumes are explicit; transfer preserves their concentration sum and cannot overshoot equilibrium. Two comparisons reset to outside 12 / inside 4 and execute one step: molecule identity without carriers; glucose without/with a carrier. Plant cells retain mitochondria. The pictured plant cell is photosynthetic, not a claim about every plant cell.
- Shape Slicer: actual cube/tetrahedron edge–plane intersections and analytic sphere circles, a separate straight-on section, adjustable solid rotation and plane height. Camera rotation does not change the model. Central cube square/diagonal hexagon and sphere center/height 0.6 comparisons are available. Tangency, empty sections, perimeter/area units, numerical rounding and dimensions are explicit.
- Adaptation Island: deterministic expected inherited-variant proportions, not changing individuals or sampled fractional organisms. Equal-weight/no-predator and absent-variant cases preserve proportions. Two comparisons use 50/50 initial proportions and exactly five generations: dark/pale environment; predation on/off. Survival weights are labeled invented; mutation, migration, drift, population-size dynamics and genetic detail are omitted explicitly.

All investigations require a prediction before either comparison can run. Each stores both observations and reveals the explanation prompt only after both trials, avoiding an answer-spoiler in the sphere prompt.

## Automated verification

- Model tests were written and observed failing before implementation. `npx vitest run packages/family-api/src/discovery-models/expansion-life-geometry.test.ts --environment node`: 9 passing tests.
- `npx vitest run packages/discovery-scenes/src/expansion/life-geometry/scenes.test.ts --environment node`: 3 passing scene/update/disposal tests, without a DOM.
- UI tests were written and observed failing before implementation. `npx vitest run src/features/discovery-lab/simulations/expansion/life-geometry/LifeGeometry.test.tsx --root frontend`: 8 passing interaction/comparison tests.
- Scoped ESLint passes for both owned package paths and the frontend lesson directory.
- Scoped frontend TypeScript verification passes (temporary config included these lesson files and the existing test setup). `npm run typecheck --workspace @family-manager/discovery-scenes` passes.
- Production files are below 350 lines. `git diff --check` passes.

## Rendered and interaction review

An isolated Vite preview used the real shared ExpansionCanvas, procedural builders and lesson controls, without a backend or full-app smoke wrapper. Chromium used `/tmp/chromium`, sandbox enabled, without permission escalation.

- Desktop 1400×1100: all three rendered actual WebGL geometry. Screenshots reviewed for scientific labels, artwork, layout, readable controls, results and model notes. No page errors or horizontal overflow.
- Mobile 390×844 with touch: all three rendered and stayed within viewport width. Tapping Transfer one step, Diagonal cube cut and Next generation changed both the mathematical readout and the canvas pixels. The additional plane rail responded to ArrowRight (0 → 0.05). No page/console errors.
- Captures retained at `/tmp/life-{cell,shape,island}-{desktop,mobile}.png` for this execution only. Temporary preview files and verification config were removed from source.
- This slice did not claim native-device or whole-app completion. The shared React-free scenes/models are available for the lead/native integration and their broader gates.
