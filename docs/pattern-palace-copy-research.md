# Pattern Palace copy and source research

Reviewed: 2026-11-02

## Lesson question

What changes when the same asymmetric motif is rotated or reflected, and when
do equal regular-polygon corners fill the 360° around one point?

The lesson separates those relationships into two controlled comparisons. It
does not treat repetition by itself as proof of a geometric rule.

## Sources reviewed

### Illustrative Mathematics — Reflections, Rotations, and Translations

URL:
https://tasks.illustrativemathematics.org/content-standards/8/G/A/1/tasks/1673

The actual task and solution were reviewed, including the transformation
instructions and lines 48–54 of the rendered solution. The source has learners
vary a reflection line and a rotation angle/center while tracking corresponding
side lengths and angle measures. Its solution states that reflected and rotated
images keep the same corresponding side lengths and angle measures. This
supports the lesson's rigid-transformation claim and the decision to hold the
motif, center and marked point fixed while changing the transformation.

The implemented comparison adds bounded coordinates for its own diagram:
point M starts at `(-30, -18)` in screen coordinates, a clockwise quarter-turn
places it at `(18, -30)`, and a vertical reflection places it at `(30, -18)`.
Those coordinates are model outputs, not values taken from the source.

### University of Cambridge NRICH — Semi-Regular Tessellations

URL:
https://nrich.maths.org/problems/semi-regular-tessellations?tab=help

The task, teacher guidance and continuation warning were reviewed. The page
uses 360° angle totals around a point to test candidate arrangements and asks
learners to predict before using an interactive test. Crucially, its teacher
guidance warns that a decagon and two pentagons can fit at one point while the
pattern cannot be continued. This directly supports the visible boundary that
a successful local corner test is not by itself proof of a plane tiling.

### University of Cambridge NRICH — Classifying Solids Using Angle Deficiency

URL:
https://nrich.maths.org/problems/classifying-solids-using-angle-deficiency

The regular-tessellation and polygon-angle sections were reviewed. The page
identifies the regular triangle, square and hexagon tessellations, gives their
60°, 90° and 120° interior angles, and shows that the angle total at each
vertex is 360°. It also derives the regular-polygon interior-angle formula
`180° - 360° / n`, giving 108° for a regular pentagon. This supports the exact
implemented values `3 × 108° = 324°` and `4 × 108° = 432°`.

## Editorial decisions

- The activity names point M instead of relying on its coral color. Coordinates
  and result text make the transformation evidence available without color.
- “Clockwise” is explicit because positive SVG rotation appears clockwise in a
  screen coordinate system whose vertical axis points down.
- The pentagon comparison changes only copy count. Regular shape, side length,
  108° interior angle and meeting point are named as held variables.
- Feedback reports both totals, the uncovered or double-covered angle, and
  whether the result matched the prediction. It does not reduce feedback to
  praise or a correctness badge.
- Free controls stay locked until both comparisons have evidence. Changing a
  guided prediction clears that comparison's evidence and relocks free
  exploration, preventing stale feedback from describing a new prediction.
- The model note distinguishes regular from irregular polygons and a local
  corner calculation from a proof over the whole plane.
- Decorative bench labels and repeated instructions were removed. The retained
  text names the current calculation, asks for a decision, reports evidence,
  or states a necessary model limit.

## Platform and visual boundary

Web and the generated native offline atlas share the palace workbench SVG.
Native platform controls use a simpler stacked composition. The downloadable
package owns a sandbox-safe model copy and vector composition; parity tests
compare its calculations and invalid cases with the shared model. These
renderings are functionally aligned but are not claimed to be pixel-identical.

The ceramic glaze, grout, inlaid arch, brass rosettes, shadowed tile depth,
motif panel and repeated-mosaic strip are visual materials. They help expose
edges, correspondence and depth but do not change any geometric calculation.
