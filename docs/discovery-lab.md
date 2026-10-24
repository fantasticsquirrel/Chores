# Discovery Lab

Discovery Lab adds **Explorations**: small, guided learning experiences where a
learner predicts what will happen, changes a model, and explains the result.
The initial collection covers orbital mechanics, reflection/refraction,
gravity, the solar system, Moon phases, photosynthesis, castle defenses, sound,
bridge structures, rivers, electrical circuits, food webs, equivalent fractions,
transformations and tessellations, caravan route tradeoffs, pollination, and
probability, simple machines, heat loss, tectonic plates, cloud formation,
hydrostatic pressure, magnetic fields, cell transport, solid cross-sections and
natural selection.

## Where it lives

- Web: `/chore/discovery-lab`, with individual pages at
  `/chore/discovery-lab/<exploration-id>` and parent controls at
  `/chore/discovery-lab/manage`.
- Native app: the Discovery Lab module, with an in-module catalog, learning
  detail, and parent access controls.
- API: `/chore-api/discovery/*`, protected by the `discovery-lab` module.

Web visuals use topic-appropriate lit WebGL exhibits and precise SVG instruments.
Native uses the same scene builders inside packaged, network-disabled WebViews,
with native controls and accessible textual results outside the renderer. All
twenty-six topics have offline visual paths; native device visual verification is
still required before release. See [native integration](implementation/discovery-native-visual-pilot.md).
Both platforms use the same content and authoritative server access. Controls
are touch/keyboard accessible; playback can be paused and honors reduced-motion
preferences. Native experiments do not animate automatically.

## Parent controls and exact precedence

A household administrator first enables Discovery Lab through the existing
household module settings. The module is **off by default for existing and new
households**. Household access, global module availability, and effective user
view/manage access are checked before any Discovery Lab request.

Inside an enabled module:

1. Every Exploration defaults to enabled for a child.
2. A saved child/Exploration override replaces that default.
3. A bulk action selects the current matching Explorations and saves individual
   overrides. Subject, grade band and tag combine with AND, not OR.
4. The most recent individual or bulk write wins for an affected Exploration.
   Unmatched Explorations and other children are not changed.
5. Bulk choices are not ongoing rules. A newly added Exploration starts enabled
   within an enabled module, even if its tags match an earlier bulk action.

The interface previews the matched count. Filters in the catalog are discovery
helpers, not assignments or curriculum certification. Grade bands are guidance,
not inferred from or attached to a child's age. Disabling module/page access
preserves saved configuration; it does not delete learning or household data.

Children receive only their own enabled catalog. A direct API request or URL for
a disabled Exploration is rejected. Parents can preview the full catalog and
manage only active children in their household. A parent with view-only module
access cannot change settings. Changes use the existing CSRF/session protection
and security audit stream.

## Content and extension guide

`packages/family-api/discovery-explorations.json` is the single trusted content
registry read by the backend and represented by shared TypeScript models.
Each entry has:

- `id`: stable URL-safe identifier; never reuse an old ID for a different concept.
- `title`, `subject`, `summary`, `question`, `explanation`, `misconception`.
- `grade_bands`: suggested bands from `K-2`, `3-5`, `6-8`, `9-12`.
- `tags`: reusable lowercase browsing/parent-control labels.
- `experiments`: `{ title, instruction, observe }` guided investigations.
- `sources`: `{ title, url }` links to supporting authoritative resources.
- `duration_minutes`: required approximate activity duration (1–180), not a timer.

To add an Exploration:

1. Add one complete registry entry. Use primary sources, age-appropriate language,
   and clearly state model/scale limitations. Do not interpolate child data into
   sources, URLs, graphics or external services.
2. Implement a web simulation in
   `frontend/src/features/discovery-lab/simulations/` and register its ID in
   `ExplorationSimulation.tsx`. Isolate deterministic math from rendering and
   add tests before implementation. Reusable platform-neutral functions belong in
   `packages/family-api/src/discovery-models/` and are imported through
   `@family-manager/family-api/discovery-models/*`.
3. Add the corresponding native scene and controls under
   `mobile/src/features/discovery-lab/`. Each shared experiment must be possible
   with the controls offered on both platforms. Keep graphics and state local.
   Reuse `packages/discovery-scenes` builders where possible. Extend the strict
   typed scene protocol and native bridge, then regenerate the packaged offline
   scene documents with the mobile build script. Check CSP, no remote requests,
   context-loss fallback and every supported state. Never send auth or child
   information to the scene document.
4. Confirm IDs, catalog filters, allowed/denied direct routes, and parent bulk
   operations still work. Do not introduce a client-authoritative allow list.
5. Add boundary-value/math, interaction, keyboard, touch, reduced-motion,
   no-overflow and meaningful accessible-result tests. Verify at a 390px mobile
   viewport and desktop; keep production components cohesive and under the
   repository architecture size limit.
6. Document any intentional simplification and notify operators that new pages
   inherit enabled status within an opted-in module. A registry-only entry is
   not complete until its actual platform simulations exist.

No plugin runtime, dynamic remote content, AI generation at runtime, child
telemetry, grades, points, or progress tracking is introduced.

## Modeling limits

- Orbits use a dimensionless two-body model, not ephemerides; a finite planet
  radius ends collision trajectories. Being in orbit is not absence of gravity.
- Optical rays use ideal smooth boundaries and Snell's law. Angles are measured
  from the normal. Ray brightness is illustrative, not a Fresnel calculation.
- Free fall ignores air resistance and treats local gravity as uniform.
- Solar-system diagrams explicitly separate schematic spacing/size from real
  relative orbital periods. They are not a real-time sky map.
- Moon phases show the portion of the sunlit half visible from Earth, not an
  Earth-shadow mechanism. Eclipses and orbital inclination are not modeled.
- Photosynthesis is a resource-limited, saturating teaching model, not a plant
  growth forecast. Temperature and other biological limits are simplified.
- Castles are a simplified 13th-century English-inspired model. Qualitative
  defensive comparisons are not historical siege predictions.

## Verification commands

From an activated backend virtualenv, at repository root:

```sh
pytest backend/tests
npm run modules:validate
npm run shared-api:gate
npm run lint
npm test
npm run build
npm run mobile:gate
npm run security:backports
python scripts/architecture-report.py --strict
git diff --check
npm run test:smoke --workspace frontend -- e2e/discovery-lab.spec.ts
```

The browser wrapper creates its own disposable SQLite database, fixture users,
loopback server and ownership nonce. The Discovery smoke seed refuses any
non-isolated database. The default smoke command without extra arguments still
runs the existing application smoke suite.

## Educational content standard

All Explorations must follow [the education-first content standard](discovery-content-standard.md). Review both lesson text and simulation feedback before adding an entry.

Current local26-topic verification: [implementation report](implementation/discovery-26-verification.md).
