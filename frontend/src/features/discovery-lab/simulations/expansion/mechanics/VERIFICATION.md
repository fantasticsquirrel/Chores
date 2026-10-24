# Mechanics learning review

Reviewed 24 October 2026 in the separate `family-discovery-next-nine` worktree.
The frozen 17-Exploration checkout was not modified by this implementation.

## Delivered

- Machine Workshop: a reeved pulley (one through four supporting rope sections),
  a lever with fixed arm proportions and vertical applied forces, and a meshed
  gear winch with equal 0.2 m crank/drum radii. Input/output work, effort force and
  distance, gear torque and turns come from the shared deterministic model.
- Heat House: a cutaway wall/window assembly with changing material, window area,
  added insulation and held indoor/outdoor temperatures. Opaque walls and windows
  always sum to 60 m². Signed transfer handles zero and inward net heat flow.
- Pressure Tank: narrow, wide and tapered open tanks, a movable surface, an outlet,
  a static pressure gauge and a calculated instantaneous jet trajectory. Volume
  changes with shape but equal head keeps pressure and initial speed unchanged.
- All three share React-free scene factories with the native renderer. Scene
  handles have ordinary slider equivalents. All meaningful readings are text,
  not color- or animation-only information.
- Each has two prediction-first controlled comparisons. Baseline and changed
  settings are explicit; specific explanation text and recorded evidence appear
  only after the comparison. Later manual changes do not relabel the recorded
  comparison as a live reading.

## Checks run

- Initial shared-model test run failed because the module did not exist, then the
  implemented module passed. The final focused shared-model/scene suite has 14
  passing tests (11 numerical, 3 scene tests).
- `npx vitest run packages/family-api/src/discovery-models/expansion-mechanics.test.ts packages/discovery-scenes/src/expansion/mechanics/mechanicsScene.test.ts --environment node`
- `cd frontend && npx vitest run src/features/discovery-lab/simulations/expansion/mechanics/MechanicsLearning.test.tsx`: 3 passing tests cover all six comparisons, prediction gating, reset, zero/reversed heat transfer and a dry outlet.
- `npx tsc --noEmit -p packages/discovery-scenes/tsconfig.json`: passed.
- `npx tsc --noEmit -p frontend/tsconfig.app.json`: passed after removing unsupported Testing Library `exact` role-query options.
- Focused frontend ESLint with `--max-warnings=0`: passed.
- `git diff --check`: passed.
- Every production file is under 350 lines; the largest scene is 317 lines.

## Rendered and editorial review

Inspected the lead's actual full-page desktop and 390 px Android captures from
`/tmp/family-manager-playwright-4h21DB/discovery-evidence/` for all three topics,
plus the shared native offline 390 px images from
`/tmp/discovery-next-nine-native-previews/`.

A first capture exposed light text on the surrounding cream page. The whole
mechanics exhibit now has its own dark background and scoped heading, paragraph
and endpoint-label colors; the subsequent captures show readable contrast.
The prediction explanation spoiler was also corrected and regression-tested.
The final captures show functioning apparatus, labeled controls, useful numeric
results, visible assumptions and no horizontal overflow. The mobile scene keeps
extra vertical space so the complete apparatus and direct controls fit.

Reviewed distinctions: supporting rope sections versus number of wheels; force
versus torque; vertical lever travel versus crank-hand travel; equal ideal work;
wall/window transfer versus a whole-house energy bill; watts versus temperature;
static tank gauge pressure versus atmospheric free-jet pressure; outlet height
versus depth below the water surface; and snapshots versus timed draining.

Boundary tests include all machine modes/ratios at minimum and maximum lift,
zero mechanical displacement, bounded/non-finite inputs, no and maximum added
insulation, fixed wall envelope, equal and reversed temperatures, a dry outlet,
all tank shapes and the tapered-tank volume integral. Scene geometry remains
finite while rebuilding across these states.

Scientific source review and the registry are coordinated by the content owner;
this implementation follows the reviewed OpenStax simple-machine, conduction,
hydrostatic and Bernoulli relationships. Native interaction/bridge tests and the
full app smoke suite are owned by the integration lead. This note does not claim
independent hardware-native testing or deployment, and no remote publishing was
performed.
