# Magnetic Fields copy and model research

Reviewed 2026-11-03 for Exploration #23. This document maps learner-facing
claims to institutional sources and separates those claims from the lesson's
explicit numerical teaching assumptions.

## Claim map

| Shipped claim                                                                                                                                      | Evidence reviewed                                                                                                                                                                                                                               | Editorial decision                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A freely rotating compass is a small magnet; its north-seeking end defines the local magnetic-field direction.                                     | [OpenStax Physics 20.1](https://openstax.org/books/physics/pages/20-1-magnetic-fields-field-lines-and-force) describes a compass as a freely rotating elongated magnet and defines field-line direction by the direction its north pole points. | Results consistently say “north-seeking end.” The model omits Earth's field, so it does not promise geographic north.                                                                           |
| Outside a bar magnet, conventional field direction runs from north toward south; complete field lines continue through the magnet in closed loops. | OpenStax Physics 20.1 and [OpenStax University Physics 11.2](https://openstax.org/books/university-physics-volume-2/pages/11-2-magnetic-fields-and-lines) show exterior N-to-S direction and continuation through the bar.                      | Exterior arrows and compass needles use that convention. Copy never presents a line as starting or stopping in space.                                                                           |
| Every ordinary bar magnet is a dipole rather than an isolated magnetic pole.                                                                       | OpenStax Physics 20.1 notes that cutting a bar produces smaller magnets with both poles and that isolated magnetic poles have not been observed.                                                                                                | Each model bar always contains a paired positive and negative surrogate source. The sources are explicitly numerical and are not called physical magnetic charges.                              |
| Like facing poles repel and unlike facing poles attract.                                                                                           | OpenStax Physics 20.1 gives this relationship and illustrates N–N/S–S repulsion and N–S attraction.                                                                                                                                             | The first controlled investigation reverses one complete bar and reports both the facing letters and interaction in noncolor text. The field index is not used as a force-between-bars measure. |
| Fields from multiple sources combine vectorially at an observation point.                                                                          | [MIT OpenCourseWare Chapter 9](https://ocw.mit.edu/courses/8-02t-electricity-and-magnetism-spring-2005/4c84733e3977ba42a930a4c0414f70d0_ch9sourc_b_field.pdf) demonstrates vector addition and superposition of magnetic-field contributions.   | The model computes one vector from each complete paired-source bar and adds the vectors. The compass follows the sum rather than selecting the nearest pole.                                    |
| Equal nonzero contributions may cancel locally without either source field disappearing elsewhere.                                                 | MIT's superposition examples show component cancellation under symmetry. OpenStax Physics 20.1 describes the very weak region between like poles and notes that a compass there would lack a stable direction if Earth's field were ignored.    | The exact symmetric midpoint is an explicit modeled null. The evidence reports both nonzero contribution indices and their zero sum, then moves one coordinate to break the cancellation.       |
| A compass can be moved point to point to map field direction.                                                                                      | [National MagLab: Drawing Magnetic Field Lines](https://nationalmaglab.org/magnet-academy/try-this-at-home/drawing-magnetic-field-lines/) and OpenStax Physics 20.1 describe compass-based field mapping.                                       | The tabletop shows multiple small compasses plus one controlled probe. Line density and placement remain illustrative rather than quantitative.                                                 |

## Numerical surrogate and units

The pure model accepts only these bounded learner inputs:

- edge-to-edge bar gap: 0.5–4.5 diagram units;
- probe x coordinate: −6–6 diagram units;
- probe z coordinate: −4–4 diagram units;
- right-bar orientation: N–S facing or the reversed N–N facing state.

Each complete bar uses two softened signed sources separated by two diagram
units. For a source at `xₚ`, the model adds a planar contribution proportional
to `sign × (x − xₚ, z) / (distance² + 0.08)^(3/2)`. Contributions are first
grouped by complete bar and then vector-added. This dipole-like construction is
only an exterior-field teaching surrogate. It is not a magnetic-monopole claim,
finite-element material model, measurement calibration or calculation inside a
bar.

The raw resultant magnitude is divided by a fixed surrogate reference of 1,
multiplied by 100 and capped at 100. The displayed 0–100 index therefore allows
comparisons only within this model. It is not tesla, force, magnetic moment or a
measurement of either physical magnet. Diagram-unit positions are not metres.
At magnitudes below `0.00001`, the model reports no preferred direction.

The probe domain marks the interior of either drawn bar as outside the model.
Earth's magnetic field, nearby magnetic or ferromagnetic material, compass
friction, material response, magnet motion, force magnitude, off-table
three-dimensional fields and the field inside a bar are omitted.

## Controlled investigations

### 1. Reverse one magnet

Prediction choices are `Interaction stays the same` and `Interaction reverses`.
The baseline has N–S facing poles. The comparison reverses only the right bar,
creating N–N facing poles. Gap 2, probe `(0, 2)` and identical bars stay fixed.
Evidence reports attraction versus repulsion, the north-seeking direction and
the normalized field index before and after the one change.

### 2. Test cancellation

Prediction choices are `Cancellation at every point` and `Cancellation only at
the midpoint`. Both states keep N–N facing poles, gap 2 and probe x 0. The
baseline probe is at `(0, 0)`; the comparison changes only probe z to 2.
Evidence reports the two equal nonzero contribution indices, their zero local
sum at the midpoint, and the nonzero sum and direction away from it.

Both investigations require a prediction before the baseline, one controlled
change, visible and numerical evidence, correct-or-incorrect feedback, a causal
explanation and reset on web, native and standalone-package surfaces.

## Field-line editorial boundary

Field lines are a representation of direction and relative pattern. They are
not physical threads, a flowing magnetic substance or particle paths. Their
drawn count and spacing in this lesson are illustrative. Real field lines form
closed loops; the scene emphasizes the exterior tabletop plane and does not
claim that its finite drawn arcs are a complete three-dimensional field map.

## Source retrieval record

The authoritative pages above were reviewed through the available web research
interface on 2026-11-03. The first restricted-runner `curl` attempts failed at
DNS, so no partial responses from those attempts were retained. The host then
retried all four exact cited URLs successfully, read the relevant HTML and PDF
content, and preserved the HTTP 200 responses under
`/root/.openclaw/workspace/media/exploration-series/magnetic-fields/sources/`.
The accompanying `cited-source-manifest.json` records final URLs, byte counts
and these SHA-256 values:

| Snapshot              | SHA-256                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `cited-source-1.html` | `4cf0045ae7b1689aecfbe4b95158a83a397749dc78cec2d032a76c702d3214b4` |
| `cited-source-2.html` | `1f0dc0201c8f84b2df342469702f39dc3fdea485102fb35aa912c3ac336c93f0` |
| `cited-source-3.pdf`  | `5e743cc2fb71785edb14aa135b6b9edbf6adaaf8e84585289916fa8134c4f126` |
| `cited-source-4.html` | `f3539e5d346b72cb3e62a864a262ff4b99f8f5c5b73523b51593200fb42d6572` |

## Editorial review

- Every heading and paragraph directs a prediction or manipulation, reports
  evidence, explains the relationship, corrects a misconception or states a
  necessary model boundary.
- Pole letters, arrow direction, compass text, interaction words and numerical
  readouts provide noncolor evidence.
- Timed motion is opt-in and explanatory only; model evidence uses the same
  final state with or without animation.
- Decorative observatory/bench labels are absent. Sources remain in the
  accessible exploration footer rather than over the teaching visual.
- Rendered desktop/mobile, native and package review remains a release gate;
  source review alone is not visual acceptance.
