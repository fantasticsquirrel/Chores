# Orbit Workshop copy and science research

Date reviewed: 2026-11-01

Exploration: `orbital-mechanics`

## Prior experience critique

The previous central 3D scene was visually attractive but showed one long
future trace at a time. Learners could predict and test only the 0.60× collision;
the 1.42× escape prompt was prose plus a preset, and central mass had no guided
prediction/action/evidence loop. The activity did not preserve the comparison
paths together, so the fair comparison depended on memory. On a 390 px viewport,
the fixed app navigation also crossed the old trace controls and explanation.

## Authoritative sources inspected

- [NASA Basics of Space Flight, Chapter 3.3: Gravity & Mechanics](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-3/)
  was inspected for the account of inward acceleration producing curved and
  circular motion, Keplerian elliptical paths, and inverse-square gravity.
- [NASA Basics of Space Flight, Chapter 3.4: Trajectories](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-4/)
  was inspected for the explanation that lower orbital energy can lower
  periapsis into a body, that an orbiting spacecraft continually falls around
  a planet, and that orbit is not the absence of gravity.
- [NASA Universe of Learning, Newton's Laws and Orbits](https://www.nasa.gov/wp-content/uploads/2023/09/nw-10182021.pdf)
  was inspected for the circular-speed relationship
  `v = sqrt(GM/r)`, including the dependence on central mass, and for the
  distinction among circular, elliptical, parabolic and hyperbolic paths.
- [NASA GSFC, Kepler's Third Law: Orbital Velocity](https://spdf.gsfc.nasa.gov/pub/documents/archived_websites/pwg.gsfc.nasa.gov/stargaze/Skepl3rd.htm)
  was inspected for the explicit result that local escape speed is √2 times
  local circular speed, that a slower tangential launch can lose altitude and
  hit the body, and that intermediate speeds can form ellipses.

These sources support the conceptual claims and analytic thresholds. They do
not validate the module's invented scale, drawn planet radius, integration
step, finite trace cutoff, or screen geometry.

## Teaching progression and surface copy

The answerable question is: **How does sideways launch speed change a falling
path?** The activity owns the complete lesson so the surrounding registry copy
is suppressed while Sources remains available.

1. The speed investigation asks for a prediction of the ordered outcomes at
   0.60×, 1.00× and 1.42× speed. It holds central mass at 1× and starting
   distance at one unit, runs all three paths, labels collision/bound
   orbit/escape, and explains the evidence. It explicitly corrects the idea
   that gravity switches off on an escape path.
2. The mass investigation is locked until the first comparison is observed.
   It asks for a prediction at 2× central mass, holds speed at 1.00× and the
   starting distance fixed, compares the 1× and 2× paths, and explains why the
   unchanged speed makes a tighter ellipse when circular speed rises to 1.414×.

The web scene labels current outcome, speed, mass, center distance, current
gravity, circular launch speed at the starting distance, inward-gravity
direction, motion direction, and traveled/future traces. Comparison plots keep
all outcomes visible together and encode each outcome with text and a symbol as
well as color. Native and rich-package lessons use the same two gated
investigations, outcomes, measurements and model caveat. The rich package
retains its established 3D renderer; this run changes its educational flow and
evidence, not that renderer.

## Model and editorial boundaries

- The shared web/native model is a dimensionless, fixed-step, two-body
  velocity-Verlet calculation. Starting center distance and the baseline
  gravitational parameter are 1; the drawn planet radius is 0.22; escape
  traces stop at radius 6.
- It omits atmosphere, other bodies, powered burns and the probe's influence
  on the central body. The finite trace is evidence of this model's outcome,
  not a real flight prediction or evidence that gravity becomes zero.
- The model calls exactly `sqrt(mass)` circular speed and
  `sqrt(2 * mass)` escape speed at the fixed starting radius. The 2×-mass
  comparison therefore uses 1.414× circular launch speed and yields a finite
  displayed trace from 0.33–1.00 starting radii at unchanged speed 1.00×. The
  sampled interval is not presented as a complete analytic apsis range.
- Copy uses the multiplication sign `×` for relative factors. No percentages
  or percentage-point claims appear in this lesson.
- Reset clears both predictions and both evidence panels and restores speed
  1×, mass 1× and trace position 0. Open controls are explicitly exploratory;
  the guided evidence remains the fixed comparison rather than being relabeled
  as evidence from arbitrary settings.

## Security and accessibility review targets

The redesign adds no HTML injection, dynamic code evaluation, network fetch,
or user-authored markup. Evidence uses fixed React text and SVG attributes from
bounded numerical model outputs. All actions are native buttons/radios or
labeled range inputs, prediction gates expose disabled state, feedback uses a
polite status region, SVGs have text alternatives, outcomes are not color-only,
touch targets are at least 44 px, and focus-visible styles are present.

## Parent visual correction

Parent review on 2026-11-01 rejected the flat semantic SVG as the primary web
artwork because it made the textured planet and probe too small and allowed
diagnostic readouts to dominate the scene. The accurate shared model and the
two gated investigations remain unchanged, but the web hierarchy is corrected:

- The primary web artwork is again a dimensional Three.js scene driven directly
  by `orbitActivity(...)` points. It uses the NASA Earth texture, an atmosphere
  shell, warm key and cool rim lighting, a detailed enlarged probe, and the
  shared gravity and motion directions.
- The default close camera turns with the current radial direction and crops the
  larger trajectory so the physical `0.22`-radius planet and nearby probe stay
  legible without changing either scale. Overview fits bounds calculated from
  every trajectory point; Follow centers the calculated probe position for long
  escape paths. The comparison diagrams remain the same-scale evidence view.
- The primary scene reports only the outcome and concise causal explanation.
  Launch settings and current distance/gravity sit in the flight controls below
  the art. Finite-sample diagnostic prose remains in the evidence diagrams and
  necessary model note, not over the art.
- Motion is opt-in, pausable and restartable. Drag, the timeline, and
  Home/End/arrow keys expose the same path without requiring animation.

Artwork is intentionally not pixel-identical across platforms. Web exposes the
enhanced close, calculated overview and probe-follow cameras. The generated
offline scene contains the enhanced renderer, while native presentation and
controls remain platform-native. The isolated rich package keeps its
established 3D renderer. All three use the same lesson order, controlled inputs,
outcomes and model limits; this correction does not claim graphical parity
among those renderers.
