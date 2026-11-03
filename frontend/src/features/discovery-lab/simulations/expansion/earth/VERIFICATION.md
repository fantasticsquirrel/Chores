# Earth exploration verification

## Implemented

- Moving Plates: selectable divergent, oceanic–continental convergent and transform boundaries; terrain cutaway and motion arrows; marked road deforms while the transform fault remains locked, then offsets after a modeled slip. Diagram progress is not elapsed geological time.
- Cloud and Rain Lab: bounded starting temperature/RH, parcel lift, representative liquid-particle diameter and below-cloud RH. One numerical saturation crossing controls displayed RH, cloud depth and condensate; complete evaporation is distinct from every positive ground-reaching diameter.
- Magnetic Fields: two bar magnets, exterior field lines, local compass needles, reversible facing poles, gap and movable probe. A symmetric null has no invented compass direction. Probes inside bars are reported outside the model domain.
- Each React lesson provides two executable prediction–comparison–explanation investigations, accessible results, numeric controls and explicit model limits. All three scene factories are DOM-free, React-free and reuse plain bounded shared state.

## Passed checks

- Cloud and Rain correction model: `npx vitest run packages/family-api/src/discovery-models/cloud-rain.test.ts --environment node --maxWorkers=2`: 8 tests.
- Cloud and Rain dimensional scene: `npx vitest run packages/discovery-scenes/src/expansion/earth/clouds.test.ts --environment node --maxWorkers=2`: 4 tests.
- `npm run test --workspace frontend -- src/features/discovery-lab/simulations/expansion/earth/EarthLessons.test.tsx`: 10 tests.
- Scoped ESLint for earth model, scenes and React files: no warnings.
- `npm run typecheck --workspace @family-manager/discovery-scenes`: passed.
- `git diff --check`: passed.
- Isolated Vite/Playwright WebGL review at 1380 px: all three scenes rendered without fallback or page errors. Examined default scenes, transform loading versus slip, subduction, cloud rain and magnetic cancellation. Reviewed the magnetic screen at 390 px; no horizontal overflow. Fixed inherited low-contrast investigation tabs, decorative surface intersections, magnet framing and probe-label placement. The last slab-exposure and probe-label corrections were covered by scene tests/typecheck after these captures.
- Model boundaries: bounded repeated fault steps and nonfinite inputs; cloud-base ±0.001 m, zero-condensate and complete-evaporation distinctions across the cloud domain; magnetic reversal, distance relationship, vector cancellation and excluded bar interiors.
- Scene tests verify substantial geometry, scientific labels, DOM-free updates and disposal.

## Deliberate limitations

The transform strain index, repeatable slip threshold and terrain geometry are invented. Other boundary types and intraplate faults can also have earthquakes. Cloud formation uses a numerically coherent but simplified parcel saturation crossing, fixed lapse rates and fixed starting pressure. The chosen representative particle is not a real size distribution or growth-time prediction; its evaporation coefficient and drawing/naming thresholds are explicit teaching choices. The model omits mixing, ice growth, vertical wind and detailed microphysics and is not a cloud-base or rainfall forecast. Magnetic paired-pole geometry is only an exterior teaching approximation, with relative units and no Earth field, needle friction or isolated physical poles.

Shared registry sources were reviewed by the content owner: NOAA plate tectonics, NOAA/NWS humidity, cloud formation, precipitation and virga, Met Office water-cycle material, and OpenStax magnetic fields. Cloud and Rain source provenance, focused correction results and the deliberately deferred final gates are recorded in `docs/cloud-rain-lab-redesign-verification.md`. No remote environment or frozen baseline worktree was modified.
