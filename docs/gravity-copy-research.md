# Gravity Drop Lab copy and science research

Date reviewed: 2026-11-01

Exploration: `gravity`

## Prior experience critique

The existing twin 3D drop towers make simultaneous position easy to see, and
the readouts correctly separate kilograms, newtons and metres per second
squared. The lesson around that apparatus is incomplete, however. Only the mass
comparison records a prediction, its result action is not gated, and its
feedback does not respond to the learner's chosen answer. The Earth–Moon
comparison is an instruction embedded in explanation text rather than a second
controlled investigation. Neither comparison preserves two named trials, so a
learner must remember an earlier state. Native has open sliders but no guided
prediction–evidence flow. The worker package mirrors those limitations.

The current detail page also repeats the same explanation and experiment prose
below the already complete activity. On a small screen, the fixed navigation
crosses the middle of the old component capture, and the separate controls,
lesson and readout regions make the causal comparison harder to scan.

## Authoritative source bodies inspected

- [OpenStax University Physics Volume 1: Free Fall](https://openstax.org/books/university-physics-volume-1/pages/3-5-free-fall)
  was inspected for the near-surface model: when air resistance and friction
  are negligible, objects at one location have the same acceleration regardless
  of mass; average Earth gravity is `9.81 m/s²`.
- [NASA Glenn: Free Falling Objects](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/free-falling-objects/)
  was inspected for `W = mg`, `a = W/m = g`, the distinction between mass and
  weight, the fact that local `g` changes by world and distance, and the need to
  include drag when an atmosphere is present.
- [NASA: What Is Microgravity? (Grades 5–8)](https://www.nasa.gov/learning-resources/for-kids-and-students/what-is-microgravity-grades-5-8/)
  was inspected for the definitions of free fall, vacuum and mass, and for the
  statement that objects in a vacuum fall at the same acceleration independent
  of mass.
- [NASA NSSDCA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/)
  and the [Moon fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)
  were inspected for rounded local accelerations: Earth about `9.8 m/s²`, Moon
  `1.62 m/s²` and Mars about `3.7 m/s²`.
- [NASA Jupiter facts](https://science.nasa.gov/jupiter/jupiter-facts/) was
  inspected for the model boundary that Jupiter is a gas giant without a true
  surface. It must not be presented as another solid-floor drop tower.

These sources support the equations and conceptual relationships. They do not
validate the drawn tower scale, uniform gravity over arbitrary distances, an
instantaneous stop at the floor, or a real drop in an atmosphere.

## Implemented learning flow and model

The answerable question is: **What changes a vacuum drop: object mass or local
gravity?** The existing 3D towers remain the primary web and package medium
because paired vertical position is the evidence. A compact distance–time plot
and named trial evidence make the comparison persist without relying on motion,
color or memory.

1. **Change only mass.** Hold Earth gravity and a 20 m release height fixed;
   compare 1 kg with 10 kg after predicting which lands first. Both trials take
   about 2.02 s. Their weights differ (`9.81 N` and `98.1 N`), but the modeled
   acceleration and position are equal. Feedback will state whether the actual
   choice matches and explain why the extra gravitational force and extra
   inertia scale together.
2. **Change only local gravity.** After the first comparison, hold mass at 5 kg
   and height at 20 m; compare Earth (`9.81 m/s²`) with the Moon
   (`1.62 m/s²`) after predicting the result. The modeled times are about
   2.02 s and 4.97 s, while the same mass weighs `49.1 N` and `8.1 N`.
   Feedback will connect weaker local acceleration to the longer fall.

Both web and native actions are disabled until a prediction is selected; the
package runtime hides each comparison action until its prediction exists.
Changing a prediction clears stale evidence, completed comparisons preserve
named evidence, and Reset restores the common initial state. Open controls
retain bounded Earth, Moon and Mars investigations without presenting Jupiter
as a floor. The visible model boundary states: vacuum;
constant local `g`; one-dimensional release from rest; no drag, wind, buoyancy,
rotation or terrain; ideal floor; not a real Jupiter-surface model.

Web and native use the same shared deterministic calculation. Native uses a
purpose-built two-lane schematic together with the regenerated offline Three.js
apparatus; the isolated worker package keeps its copied 3D towers and
package-local model while matching the lesson states, units, gates and feedback.

## Accessibility and security review

Controls are native keyboard or React Native actions with visible focus, 44 px
targets and text outcomes. Line style, labels and numeric tables supplement
color in the chart. Reduced motion leaves every result available through
selection and text. No user-authored markup, dynamic evaluation, network
request or authority boundary is introduced; numeric inputs stay bounded before
entering the scene or package renderer. Automated model, lesson, package,
security and architecture checks are recorded in
`docs/gravity-redesign-verification.md`. The required rendered after-image
review is complete: original and redesigned desktop/mobile screens, both
operated investigations, the 50 m boundary, paused motion, reduced motion,
WebGL fallback, and ordinary mobile scrolling were inspected directly. Staged
evidence is under
`/root/.openclaw/workspace/media/exploration-series/gravity/`.
