# Light Bending Studio copy and science research

Date reviewed: 2026-11-01

Exploration: `reflection-refraction`

## Prior experience critique

The prior circular optical bench was attractive and functional, but the lesson
was mostly an open set of numerical controls. It showed only the current ray,
used `n₁` and `n₂` without consistently naming the media, and did not require a
prediction or preserve a controlled comparison. The learner had to remember
earlier states to compare them. The surrounding explanation repeated concepts
without turning them into evidence. On mobile, the fixed navigation crossed the
lower control/evidence area in a full-page capture.

## Authoritative sources inspected

- [OpenStax University Physics Volume 3: The Law of Reflection](https://openstax.org/books/university-physics-volume-3/pages/1-2-the-law-of-reflection)
  was inspected for the rule that the reflected angle equals the incident angle
  and that both are measured from the normal to the surface.
- [OpenStax University Physics Volume 3: Refraction](https://openstax.org/books/university-physics-volume-3/pages/1-3-refraction)
  was inspected for `n = c/v`, Snell’s law `n₁ sin θ₁ = n₂ sin θ₂`, and the
  toward-the-normal versus away-from-the-normal relationships when light enters
  higher- or lower-index media.
- [OpenStax University Physics Volume 3: Total Internal Reflection](https://openstax.org/books/university-physics-volume-3/pages/1-4-total-internal-reflection)
  was inspected for the two required conditions: travel from higher to lower
  refractive index and an incident angle above that material pair’s critical
  angle. At the critical angle, the refracted ray is along the boundary; total
  internal reflection begins only above it.

The sources support the equations and concepts. They do not validate the
screen geometry, fixed ray brightness, selected teaching angles, or the use of
one representative color.

## Checked numerical relationships

The shared model uses air `n = 1.000`, water `n = 1.333`, and glass `n = 1.500`.
Values are rounded only for display.

- Glass → air has a critical angle of `41.81°`.
- Glass → air at `40°` refracts to `74.62°`; at `43°` it undergoes total
  internal reflection.
- Air → glass at `30°` refracts to `19.47°`; glass → air at `30°` refracts to
  `48.59°`. Reflection remains `30°` in both cases.
- Water → air begins total internal reflection above `48.61°`.
- At the exact critical angle, the model returns a `90°` refracted ray and does
  not label the state TIR. At normal incidence the ray stays on the normal.
  Equal-index media transmit straight through without a reflected branch in
  this ideal boundary model.

## Teaching progression and functional copy

The answerable question is: **How do angle and travel direction change a ray at
a boundary?** The activity owns the complete lesson, so repeated registry
explanation cards are suppressed while Sources remains accessible.

1. **Cross the critical angle** begins with the visible glass → air, `40°`
   baseline. The learner predicts whether a transmitted ray remains at `43°`,
   runs the comparison with material direction fixed, and can switch the central
   instrument between both preserved trials. Feedback names `74.6°`, the
   `41.8°` critical angle, and the absence of a transmitted ray at `43°`.
2. **Reverse the boundary** stays locked until the first comparison is
   observed. The learner predicts the direction change, holds the incident angle
   at `30°`, compares air → glass with glass → air, and can switch the instrument
   between both results. Feedback names `19.5°`, `48.6°`, toward/away bending,
   and the unchanged `30°` reflection angle.

Visible copy has a specific job:

- `FROM`, `TO`, material names, indices, normal, angle labels, ray key and live
  readouts identify the modeled state and evidence.
- Prediction choices state the competing outcomes; action labels state the
  exact controlled comparison; trial buttons retain both observations.
- Match/differ feedback responds to the learner’s actual choice and then
  explains the measured evidence.
- `Open controls` supports boundary and counterexample exploration without
  relabeling arbitrary settings as guided evidence.
- `Why the ray changes` links refractive index to light speed, explains
  toward/away bending with Snell’s law, and corrects the idea that a large angle
  alone causes TIR.
- `Model boundary` states that the one-color geometric-ray model omits
  absorption, scattering, polarization and color separation, and that drawn
  brightness is not a calculated energy split.

No decorative bench label, mood tagline, score, praise, or repeated experiment
prose was added.

## Platform and package boundary

- Web uses a layered rectangular SVG optical instrument with named media,
  material treatment, ray arrows, protractor ticks, normal, angle arcs, critical
  marker and a TIR state.
- Native consumes the same shared model and runs the same two gated comparisons,
  trial switching, open boundaries, reset and caveat in a simplified layered
  schematic suited to React Native. It does not claim pixel-for-pixel visual
  parity.
- The isolated worker-rich package mirrors the equations and lesson in its
  package-local security boundary. It retains the established circular metal
  instrument and arbitrary numeric index controls. This redesign corrects its
  upper/lower medium shading and adds buttons for every fixed trial. Known index
  values are named Air, Water or Glass; other allowed values are explicitly
  labeled Custom. Unlike the bundled lesson, package controls are not limited to
  three named materials.

## Accessibility and security review targets

Meaningful outcomes are available as text and accessible image descriptions,
not only ray color. Web actions are native buttons/selects/range inputs with
focus-visible treatment, disabled prediction gates, polite live readouts and a
reduced-motion rule. Native actions use accessible buttons/radios and live
explanations. The redesign adds no user-authored markup, dynamic evaluation,
network fetch or new backend authority. All visual values come from bounded
model inputs; the package remains inside the existing validated worker contract.
