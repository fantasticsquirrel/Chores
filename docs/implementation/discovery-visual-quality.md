# Discovery Lab visual-quality revision

Status, 2026-10-24: the richer visual implementation covers all 17 Explorations.
The consolidated authenticated desktop/mobile browser journeys and local
regression gates pass. Independent visual/editorial review reports no blocking
findings. The Moon and castle examples established the approved direction, not
blanket acceptance of every lesson. Local implementation/review is complete;
physical-device verification and user collection-wide visual acceptance remain
open. This is not a release, publication or native-device visual-parity claim.

## Required direction

Education is the primary purpose. Follow
[`discovery-content-standard.md`](../discovery-content-standard.md) for the
catalog, lesson shell, rendered scene, controls, accessible descriptions and
feedback. Visible text must identify a concept or current state, direct an
investigation, explain evidence, or state a necessary limitation. Do not add
mood taglines, exhibit branding, redundant scene headings, promotional claims,
AI/production commentary, or generic filler. The reported Moon branding and
flavor copy were removed; attribution belongs in Sources or the footer.

Use a large, topic-appropriate exhibit with considered composition, materials,
lighting, spatial depth and direct manipulation where meaningful. Do not force
3D when it would distort measurable geometry. Each control must affect the
modeled result. A prediction, observable comparison and causal explanation are
more important than decoration.

## Implemented web architecture

`ExplorationSimulation.tsx` registers all 17 lesson components. Fifteen use
lazy-loaded Three.js renderers; Optics and Pattern deliberately retain exact
planar SVG geometry. The shared educational calculations remain separate from
renderer materials, camera framing and interaction adapters.

| Explorations                                                            | Rendered treatment and implementation boundary                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orbit Workshop; Solar System Explorer; Gravity Drop Lab                 | `simulations/space/`: lit planetary bodies and satellite/path geometry, eight-planet orbital and same-scale diameter views, and paired glass-and-metal drop apparatus. HTML controls/results remain separate from canvas text.                                                                     |
| Moon Phase Observatory                                                  | `simulations/moon/` hosts the shared `@family-manager/discovery-scenes/moon` renderer. Local NASA LRO color/elevation maps, directional sunlight, direct orbit scrub and an Earth-view disk; the orbit inset explains the view.                                                                    |
| Light Bending Studio                                                    | `simulations/optics/OpticsBench.tsx`: top-down material optical bench, normal/protractor and directly adjustable incident ray. Planar rendering preserves the measured angles and total-internal-reflection boundary.                                                                              |
| Leaf Energy Lab                                                         | `simulations/botany/`: dimensional leaf/cell cross-section with scientific input/output callouts. Resource controls feed the existing activity model, not a plant-growth forecast.                                                                                                                 |
| Castle Design Lab                                                       | `simulations/castle/`: terrain, ditch, walls, gatehouse, towers and route comparisons. Sight-line overlays are **off initially and after reset**; when explicitly enabled, dashed rays are explanatory lines, not structural cables.                                                               |
| Sound Playground; Bridge Builder; Circuit City                          | `simulations/physical-exhibits/`: sonometer with movable bridge and separate pressure trace; load-bearing bridge with grounded truck/approaches; connected circuit town with physical switches and load-dependent windows. Pure typed builders support reuse.                                      |
| River Sculptor; Food Web Rescue; Caravan Crossroads; Pollinator Express | `simulations/landscape/` hosts builders in `packages/discovery-scenes/src/landscape/`: changing river terrain/sediment, population-dependent pond, route/cargo landscape and connected flower habitat. Model states are supplied separately; graphs and numerical evidence stay outside the scene. |
| Fraction Feast; Pattern Palace; Chance Carnival                         | `simulations/tactile/`: equal-sized plated pizza with thick selectable slices; exact ceramic-tile corner and transformation workbench; adjustable probability wheel/rounded die with the actual final sampled outcome and a theory-versus-observation chart.                                       |

Web renderer locations above are under
`frontend/src/features/discovery-lab/`. Shared mathematical models remain in
`packages/family-api/src/discovery-models/` and the existing physics helpers.
The renderers do not introduce accounts, analytics or stored learning progress.

## Lifecycle, assets and access

- Rendering is demand-driven by state, size or asset changes. Continuous motion
  is not started automatically; explicit playback is pausable and manual
  controls remain available under reduced motion.
- Renderer pixel ratio is capped at 1.5. Resources, observers, event listeners
  and GPU objects are disposed. Heavy renderers are lazy chunks; Three.js is
  shared rather than duplicated per lesson.
- NASA source images and notices are bundled locally; other surfaces use
  procedural geometry/materials. No scene fetch sends child data to a third
  party. Keep asset provenance and license notices with the source.
- Accessible descriptions, numerical results and keyboard/touch controls remain
  available without motion. WebGL failures retain working controls/results and
  a diagram or textual fallback, depending on the lesson. These fallbacks do
  not claim equal visual richness.
- Existing authoritative module opt-in, household scoping and per-child lesson
  access remain unchanged. A rich renderer is not an authorization boundary.

## Native implementation is a separate verification layer

All 17 native lessons now have offline visual integration while retaining native
controls, model calculations, reset behavior and readable results. Fifteen use
scene-only WebGL documents; Optics and Pattern use finite SVG variants generated
from the same source at build time. The bounded bridge sends only validated
visual state, not account, child, authentication or API-client data. No hosted
page or runtime React DOM application is embedded.

This supersedes the earlier schematic-only implementation description. It does
**not** establish Android/iOS device behavior or visual parity. Exact generated
HTML browser tests, mocked native component tests and Metro/Hermes export are
not native-device tests. See
[`discovery-native-visual-pilot.md`](discovery-native-visual-pilot.md) for the
source boundaries, offline-document freshness/security checks, new-binary
requirement and mandatory Android/iOS release checks.

## Verification state

The current coordinated pass has established:

- Frontend lint passed; 600 frontend tests across 98 files passed.
- Shared API/model tests passed: 429 tests across 24 files. Module/manifest
  validation passed: 10 tests. The production TypeScript/Vite build passed.
  The monolithic backend run passed 792 tests; 25 security checks and the
  original application smoke suite (three scenarios) also passed.
- Native verification passed 280 unit tests and 424 UI tests, shared/native
  typechecks, offline-document freshness checks and Android Metro/Hermes export.
  Exact offline-document browser checks passed for all 17 scenes and all 74
  finite SVG variants. These remain distinct from physical-device verification.
- The architecture report records zero boundary violations; existing unrelated
  hotspots remain reported. Do not describe that as elimination of all debt.
- The consolidated all-17 authenticated browser journeys passed at desktop and
  390px mobile width: two scenarios, meaningful pixel changes for each scene,
  parent bulk/per-child access persistence, and direct child detail API denial
  with HTTP 403 for a disabled lesson.
- Actual desktop and 390px mobile-browser render captures were inspected for the
  upgraded topic groups. These are browser screenshots, not generated mockups
  or Android/iOS device screenshots. Topic-only previews and authenticated app
  captures are distinguished in their verification notes.
- Dedicated Moon, physical-exhibit and tactile browser checks passed. Physical
  and tactile checks include actual touch-enabled contexts, direct manipulation,
  keyboard controls and changed-state evidence. For example: the truck rests on
  its deck; circuit switches change the correct branch; pizza selection preserves
  fractions; four pentagons show 72° overlap; the die top matches the sampled
  outcome after 10,000 trials.
- Independent science, visual, accessibility and no-filler review reports no
  blocking findings after manually inspecting all 34 desktop/mobile topic
  captures. Actual GPU context loss was verified. Final corrections include
  mobile optics readability, context-loss handling and Food Web fair-comparison
  instructions; the detailed audit record accompanies local QA.
- Captured defects were corrected and recaptured: floating bridge load,
  fraction labels covering portions, rectangular canvas background seams,
  insufficient note/number contrast and shared button styles obscuring selected
  state. Necessary model caveats remain visible.

Durable browser coverage is in `frontend/e2e/discovery-lab.spec.ts`,
`discovery-moon-exemplar.spec.ts`, `discovery-visuals.spec.ts`,
`discovery-physical-interactions.spec.ts`, and `discovery-tactile.spec.ts`.
Tests use disposable fixtures and an isolated loopback server, not production
data. An earlier consolidated run exposed a canvas-state comparison failure;
the corrected all-17 rerun now passes. This establishes the tested behavior,
not independent scientific accuracy, full accessibility or user visual approval.

## Local completion and remaining acceptance

- [x] Complete the consolidated all-17 authenticated desktop/mobile browser
      rerun after the renderer and test corrections.
- [x] Complete independent manual inspection of all 34 final topic captures.
- [x] Complete independent scientific, historical, accessibility and no-filler
      review; no blocking findings remain in the local review.
- [x] Complete the coordinated local automated gates, including native offline
      document/type/freshness checks and export validation.
- [ ] Verify Android and iOS startup, gestures/scrolling, screen readers, offline
      loading, context/process loss and repeated navigation on devices/emulators.
- [ ] Obtain user collection-wide visual acceptance. Approval of the Moon/castle
      direction does not certify all 17.
- [ ] Complete any separately authorized release/device packaging and deployment
      process. Local tests and export validation are not a deployed release.

No push, merge, remote publication, deployment or production change is authorized
by this checkpoint.
