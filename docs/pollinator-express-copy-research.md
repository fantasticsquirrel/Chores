# Pollinator Express copy and source research

Reviewed: 2026-11-02

## Lesson question

What can flower visits tell us about pollen transfer, and what can they not
tell us about fertilization, seed formation or seed dispersal?

The lesson uses two prediction-before-evidence investigations. Both are
deterministic teaching comparisons. Institutional sources support the biology
language; they do not validate any coordinate, distance, count or habitat
effect in the model.

## Institutional sources opened

### USDA Natural Resources Conservation Service — Insects and Pollinators

URL:
https://www.nrcs.usda.gov/conservation-basics/animals/insects-pollinators

The NRCS page explains that animal pollinators visit flowers seeking resources
such as nectar and pollen and may deposit pollen carried from another flower.
It connects pollination with later fruit and seed production without saying
that every visit succeeds. It also describes habitat loss and other pressures
on pollinators.

Implemented mapping:

- Web, native, package and registry copy say pollinators often seek nectar or
  pollen and may transfer pollen during a visit.
- Copy says a visit does not guarantee pollination, fertilization, fruit or
  seeds.
- The habitat comparison is described only as route connectivity inside the
  invented garden. The source is not used to claim a numerical population or
  conservation outcome.

### National Park Service — Great Smoky Mountains Pollinators

URL:
https://www.nps.gov/grsm/learn/nature/pollinators.htm

The NPS page defines pollination as pollen movement from the male flower part
to the receptive female part. It explains that this movement occurs before
fertilization and that fertilization permits later fruit and seed formation.
It also notes varied pollinators, wind or water transfer, self-pollination and
relationships between native plants and pollinators.

Implemented mapping:

- The visible process explanation puts pollination before fertilization and
  does not label a received-pollen mark as a seed.
- Notes say plants vary in compatibility and self-pollination, and do not
  imply that bees are the only pollen carriers.
- The lesson describes a plant–pollinator exchange: the visitor seeks food;
  the plant may receive pollen. It does not promise either outcome for every
  visit.

### USDA-hosted SARE handbook — Managing Alternative Pollinators

URL:
https://efotg.sc.egov.usda.gov/references/public/SC/Managing_Alternatives_for_Pollinators_Xerces_2010.pdf

The handbook’s flower-reproduction section describes compatible pollen
landing on a stigma, pollen germination and tube growth, sperm movement down
the tube, fertilization of an egg, and subsequent embryo and seed development.
It also explains nectar and pollen as flower resources and describes pollen
transfer as the plant-side result of animal flower visits.

Implemented mapping:

- The process explanation distinguishes pollen transfer from the later
  pollen-tube and sperm–egg steps of fertilization.
- “Compatible transfer” is presented as a deliberately simplified model rule.
  The notes explicitly say real compatibility can differ even within one
  species.
- No lesson copy claims that pollen receipt proves fertilization or seed
  development.

### National Park Service — Plant Adaptations

URL:
https://www.nps.gov/teachers/classrooms/plant-adaptations.htm

The NPS teaching resource separates seed dispersal by wind, water and animals
from flower pollination. It describes dispersal as movement of seeds after
they exist.

Implemented mapping:

- Web, native and package say seed dispersal moves formed seeds away from a
  parent plant.
- Seed dispersal is explicitly outside this lesson’s recorded process.

### OpenStax Biology 2e — Pollination and Fertilization

URL:
https://openstax.org/books/biology-2e/pages/32-2-pollination-and-fertilization

The institutional textbook defines pollination as transfer from anther to
stigma, then separately describes pollen-tube growth and sperm fertilizing the
egg. It also describes nectar and pollen as food rewards and distinguishes
self- from cross-pollination. The supervisor independently fetched and read
this page on 2026-11-02; it is the primary wording check for the lesson’s
pollination-versus-fertilization distinction.

Implemented mapping:

- All three lesson surfaces call pollen transfer pollination and present
  pollen-tube growth and sperm–egg joining as later fertilization steps.
- A received-pollen mark is never described as fertilization, fruit or seed.

## Invented deterministic teaching assumptions

No source above validates these numbers or placements:

- nest coordinate `(70, 320)` and every flower coordinate;
- reach range 80–240, fixed comparison reach 170 and 10-unit steps;
- the Gold and Violet display types and the rule that only different flowers
  of the same displayed type count as compatible;
- one remembered pollen source, rather than a mixed pollen load;
- the fixed trial-flower position `(230, 195)`;
- the bridge habitat patch’s Gold `(350, 205)` and Violet `(340, 300)` flower
  positions and the planned route, which uses the Gold stop only;
- all visit, transfer, receiving-flower and blocked-attempt counts produced by
  those rules;
- enlarged bee, flower and pollen structures in the dimensional scene.

These are schematic garden units and deterministic outputs, not measured bee
flight distances, ecological probabilities, conservation effects or
forecasts.

## Controlled investigation mapping

### 1. Change only the fixed trial flower’s displayed type

Both inputs attempt `Gold 1 → trial flower`. The nest, first flower, second
position `(230, 195)`, reach 170, absent bridge habitat, coordinates and
transfer rule remain identical. Only `trialSpecies` changes from Gold to
Violet. Both conditions record 2 visits. Gold records 1 compatible transfer
and 1 receiving flower; Violet records 0 and 0.

### 2. Change only habitat presence

Both inputs attempt the exact sequence
`Gold 1 → Gold 2 → Gold bridge → Gold 3` at reach 170. The nest, planned route,
target, coordinates and transfer rule remain identical. Only `habitat` changes
from absent to present. In the scene that Boolean adds one bridge habitat patch
containing both a Gold and a Violet flower; the fixed planned route attempts
the Gold bridge stop and does not visit the Violet flower. With the patch
absent, the Gold bridge attempt is unavailable and the unchanged-position
attempt to Gold 3 is beyond reach: 2 visits, 1 transfer and 2 blocked attempts.
With the patch present, all 4 planned visits succeed with 3 compatible
transfers and Gold 3 reached.

Changing a prediction clears that investigation’s evidence and relocks free
exploration. Reset clears both predictions and both feedback blocks, restores
the nest state and relocks controls.

## Editorial and visual decisions

- Evidence names the changed input and all held conditions.
- Numeric results are labeled model evidence; the boundary calls every number
  an invented assumption rather than an ecological forecast.
- A raised ring plus a text check mark identifies pollen received without
  relying on color. It never represents fertilization or a seed.
- The fixed trial flower occupies one position and changes visible structure,
  color and text label with the treatment so art and evidence stay coherent.
- The central object remains a dimensional raised garden with soil, plants,
  visible reproductive structures, a bee, route, reach and cast depth. State
  changes are purposeful; no ornamental continuous motion is required.
- Reach and route evidence use paired dark/light strokes so neither light soil
  nor dark vegetation erases the visual trace. The narrow layout uses a
  shorter canvas and a closer default garden framing.
