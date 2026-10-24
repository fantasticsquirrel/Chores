# Earth exploration verification

## Implemented

- Moving Plates: selectable divergent, oceanic–continental convergent and transform boundaries; terrain cutaway and motion arrows; marked road deforms while the transform fault remains locked, then offsets after a modeled slip. Diagram progress is not elapsed geological time.
- Cloud and Rain Lab: bounded warm-air parcel temperature, water-vapor mixing ratio, lift and a separate illustrative growth index. Condensation and falling-drop states are distinct.
- Magnetic Fields: two bar magnets, exterior field lines, local compass needles, reversible facing poles, gap and movable probe. A symmetric null has no invented compass direction. Probes inside bars are reported outside the model domain.
- Each React lesson provides two executable prediction–comparison–explanation investigations, accessible results, numeric controls and explicit model limits. All three scene factories are DOM-free, React-free and reuse plain bounded shared state.

## Passed checks

- `npx vitest run packages/family-api/src/discovery-models/expansion-earth.test.ts packages/discovery-scenes/src/expansion/earth/earth-scenes.test.ts --environment node --maxWorkers=1`: 11 tests.
- `npm exec --workspace frontend -- vitest run src/features/discovery-lab/simulations/expansion/earth/EarthLessons.test.tsx`: 4 tests.
- Scoped ESLint for earth model, scenes and React files: no warnings.
- `npm run typecheck --workspace @family-manager/discovery-scenes`: passed.
- `git diff --check`: passed.
- Isolated Vite/Playwright WebGL review at 1380 px: all three scenes rendered without fallback or page errors. Examined default scenes, transform loading versus slip, subduction, cloud rain and magnetic cancellation. Reviewed the magnetic screen at 390 px; no horizontal overflow. Fixed inherited low-contrast investigation tabs, decorative surface intersections, magnet framing and probe-label placement. The last slab-exposure and probe-label corrections were covered by scene tests/typecheck after these captures.
- Model boundaries: bounded repeated fault steps and nonfinite inputs; cloud/no-cloud/no-rain distinctions; increasing moisture versus starting temperature; all cloud-domain corner temperatures remain above freezing; magnetic reversal, distance relationship, vector cancellation and excluded bar interiors.
- Scene tests verify substantial geometry, scientific labels, DOM-free updates and disposal.

## Deliberate limitations

The transform strain index, repeatable slip threshold and terrain geometry are invented. Other boundary types and intraplate faults can also have earthquakes. Cloud formation uses an approximate condensation level and fixed lapse rates at a fixed starting pressure; mixing, ice and evaporation are omitted. The growth index is not a physical droplet size or rainfall forecast. Magnetic paired-pole geometry is only an exterior teaching approximation, with relative units and no Earth field, needle friction or isolated physical poles.

Shared registry sources were reviewed by the content owner: NOAA plate tectonics, NOAA cloud formation and precipitation, and OpenStax magnetic fields. Native registration, offline bundle smoke and whole-app checks belong to the integration gate; this scoped verification does not claim they were independently run here. No remote environment or frozen baseline worktree was modified.
