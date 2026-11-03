# Pressure Tank copy research

Reviewed and opened 2026-11-03 for the Pressure Tank redesign. These sources
support the physical relationships and unit language. The tank dimensions,
outlet heights, sensor area and rounded constants are disclosed teaching inputs;
they are not measurements or equipment specifications taken from the sources.

## Claim map

| Learner-facing claim                                                                                                                                                                                                                   | Authoritative support                                                                                                                                                                                                                                                                                                                                                                                                             | Implemented in                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| In a still liquid of fixed density, pressure above the free-surface value rises by `ρgh`, where `h` is vertical depth below that surface. Tank width and total water volume do not enter that static relationship.                     | [OpenStax College Physics 11.4: Variation of Pressure with Depth in a Fluid](https://openstax.org/books/college-physics/pages/11-4-variation-of-pressure-with-depth-in-a-fluid) derives `P = hρg` for pressure due to a fluid column.                                                                                                                                                                                             | Shared `pressure-tank.ts` model; head bracket and gauge; both controlled investigations; equal-head shape comparison.          |
| Gauge pressure is measured relative to atmospheric pressure. Absolute pressure equals atmospheric plus gauge pressure.                                                                                                                 | [OpenStax College Physics 11.6: Gauge Pressure, Absolute Pressure, and Pressure Measurement](https://openstax.org/books/college-physics/pages/11-6-gauge-pressure-absolute-pressure-and-pressure-measurement) defines both quantities and gives `P_abs = P_g + P_atm`. [NIST SP 811 Appendix B](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors) gives `1 atm = 101 325 Pa` exactly. | Separate gauge and absolute readouts in web, native, rich scene and standalone package; fixed 101.325 kPa teaching atmosphere. |
| Pressure is force per area. Uniform gauge pressure gives net force `F_net = p_gauge A` on a closed sensor when its opposite face is exposed to atmosphere. The pascal is `N/m²`.                                                       | [OpenStax University Physics 14.1: Fluids, Density, and Pressure](https://openstax.org/books/university-physics-volume-1/pages/14-1-fluids-density-and-pressure) defines `p = F/A`. [NIST SP 811 chapter 4](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-4-two-classes-si-units-and-si-prefixes) lists `Pa = N/m²`.                                                                                     | Fixed closed 100 cm² (`0.0100 m²`) wall sensor with atmospheric back face, net-force arrow/readout and controlled evidence.    |
| For a large open reservoir with negligible resistance and surface speed, equal atmospheric pressure at the surface and emerging free jet gives ideal outlet speed `v = √(2gh)`. The free jet is approximately at atmospheric pressure. | [OpenStax College Physics 12.3: The Most General Applications of Bernoulli’s Equation](https://openstax.org/books/college-physics/pages/12-3-the-most-general-applications-of-bernoullis-equation) derives Torricelli’s theorem and states the simplifying pressure and resistance conditions.                                                                                                                                    | Ideal-speed readout, parabolic jet geometry, square-root comparison, package and native explanations, model boundary.          |
| With a horizontal initial velocity, horizontal motion is uniform while vertical fall is accelerated by gravity; eliminating time gives a parabolic path.                                                                               | [OpenStax University Physics 4.3: Projectile Motion](https://openstax.org/books/university-physics-volume-1/pages/4-3-projectile-motion) gives independent horizontal/vertical equations and the parabolic trajectory.                                                                                                                                                                                                            | `fallTime = √(2y/g)`, `range = vt`, rich-scene jet path, range ruler, impact marker and native fallback segments.              |
| A representative water density is `1,000 kg/m³`; density can vary with conditions, so the lesson must state that it is fixed.                                                                                                          | [OpenStax College Physics 11.2: Density](https://openstax.org/books/college-physics/pages/11-2-density) tabulates water at `1.000 × 10³ kg/m³`.                                                                                                                                                                                                                                                                                   | Fixed-density model input and explicit omission of temperature-dependent density.                                              |

## Editorial and model boundaries

- “Water surface height” and “outlet height” are both measured from the tank
  floor. Their difference, when positive, is the pressure head. “Depth” is not
  used by itself in learner controls because it could be mistaken for either
  surface height or depth below the surface.
- Gauge and absolute pressure are never used interchangeably. The water-column
  contribution is gauge pressure; the displayed absolute value adds the fixed
  teaching atmosphere of 101.325 kPa.
- The displayed pressure applies to the separate closed wall sensor at the
  outlet's height, not to the emerging free jet. The force result is net force
  on its stated 100 cm² area because the opposite face is exposed to atmosphere.
  It is not a wall-load or vessel-strength calculation.
- The dark link from that sensor to the elevated remote display is an insulated
  electrical signal cable, not a liquid-filled pressure line. Display elevation
  therefore does not change the modeled sensing height.
- The speed and range are ideal snapshot values. They assume an open tank, a
  small horizontal outlet, negligible surface speed, incompressible frictionless
  flow, equal atmospheric pressure at the surface and free jet, ideal gravity
  and no air drag. The water level does not fall with time.
- The shape comparison holds surface and outlet height fixed at one instant.
  Shape changes volume but not `ρgh` or `√(2gh)`; a real tank’s shape would
  affect how quickly its level falls during draining, which this model omits.
- The model fixes fresh-water density at 1,000 kg/m³ and does not accept
  temperature. No kelvin/Celsius conversion is therefore performed. Real
  density varies with temperature and composition.
- The displayed dimensions are selected teaching inputs, not measurements,
  pressure-vessel ratings, equipment specifications or guidance for building,
  pressurizing or operating a real tank.
