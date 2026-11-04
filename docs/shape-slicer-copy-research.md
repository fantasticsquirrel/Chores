# Shape Slicer copy and model research

Reviewed 2026-11-04 for Exploration #25.

## Claim map

| Shipped claim                                                                       | Evidence reviewed                                                                                                                                                                                                         | Lesson boundary                                                                                                                                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A cross-section is the two-dimensional intersection of a solid and a plane.         | [Illustrative Mathematics, Slicing Solids](https://im.kendallhunt.com/HS/students/2/5/2/index.html) defines a cross-section this way and has learners predict sections as a plane moves through a cube.                   | Copy distinguishes the mathematical plane section from a shadow, outer face or thick physical slice.                                                                      |
| One cube can make different polygonal sections as plane orientation changes.        | [Illustrative Mathematics, Cube Ninjas!](https://tasks.illustrativemathematics.org/content-standards/7/G/A/3/tasks/1532) uses rectangle, triangle and pentagon cube sections and emphasizes precise section descriptions. | The controlled trial changes only cube orientation. Its selected symmetric diagonal plane is computed from exact edge-plane intersections and produces six vertices.      |
| Parallel plane sections of a sphere remain circles but shrink away from the center. | Illustrative Mathematics, Slicing Solids shows sphere sections growing toward the center and shrinking past it, and defines a sphere by equal distance from its center.                                                   | For radius 1 and plane height `h`, the model uses `r = sqrt(1 - h²)`, `area = πr²` and `boundary = 2πr`. At `h = 0.6`, radius is 0.8 and area is 64% of the central area. |

## Controlled investigations

1. Rotate a side-2 cube while keeping the horizontal plane at height 0. The
   face-parallel section is a square with four sides and area 4.00. The chosen
   diagonal orientation reaches six faces and makes a hexagon with area 5.20.
2. Move a parallel plane through a radius-1 sphere from height 0 to 0.6. Both
   sections are circles; radius changes from 1.00 to 0.80 and area from 3.14 to
   2.01 square units.

Both paths require a prediction, name the changed variable and held controls,
report correct or incorrect feedback with numerical evidence, clear stale
evidence after manual control changes and reset fully on web, native and the
standalone package.

## Model boundary

The cube, tetrahedron, sphere and plane are ideal. Polygon sections use
computed edge-plane intersections; sphere readouts use exact circle formulas.
Displayed values are rounded to two decimals. A tangent plane can produce a
point or line with zero area, and a plane outside a solid produces no section.
Camera motion changes only the view. Material thickness, cutting deformation
and measurement uncertainty are outside the model.

## Source retrieval

Both cited pages were read and preserved as HTTP 200 snapshots on 2026-11-04.

| Snapshot                                       |  Bytes | SHA-256                                                            |
| ---------------------------------------------- | -----: | ------------------------------------------------------------------ |
| `illustrative-mathematics-cube-sections.html`  |  30191 | `4e9585cb2e08d27692f0cc1b908b9d68e025b99df27bf2f3b22878ed8d560873` |
| `illustrative-mathematics-slicing-solids.html` | 143483 | `1abbe5cd68dc5680dbb100d711b94aa96257a69997b4248aafadb00d8106cda5` |

## Editorial review

Copy directs prediction, one controlled manipulation, evidence reading,
explanation or a necessary boundary. Side count, section names, radius, area
and boundary length provide noncolor evidence. Sources stay in the accessible
footer rather than over the teaching visual.
