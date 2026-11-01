# Leaf Energy Lab copy and research record

Date: 2026-11-01

This record covers every learner-facing string family in the built-in web and
native activities, the independently sandboxed package, and the Discovery Lab
catalog entry. It supplements the pre-edit audit in
`docs/photosynthesis-refinement-plan.md`.

## Source-body findings used

The linked bodies, not search-result snippets, were inspected.

| Claim used in the lesson                                                                        | Inspected source body                                                                                                                                                                                                                                                      | Editorial result                                                                                                                             |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Light is an energy source; water and carbon dioxide are inputs used to make carbohydrate.       | OpenStax Biology 2e, [8.1 Overview of Photosynthesis](https://openstax.org/books/biology-2e/pages/8-1-overview-of-photosynthesis)                                                                                                                                          | Say “light energy” and distinguish energy from matter. Do not call light food.                                                               |
| Oxygen released in photosynthesis comes from the splitting of water.                            | OpenStax Biology 2e, [8.2 The Light-Dependent Reactions](https://openstax.org/books/biology-2e/pages/8-2-the-light-dependent-reactions-of-photosynthesis)                                                                                                                  | State provenance only in the process explanation; do not imply that the toy index models the reaction steps.                                 |
| Plants respire continuously, including in daylight and at night.                                | [Royal Horticultural Society: plant gas exchange](https://www.rhs.org.uk/advice/understanding-plants/how-plants-breathe) and [University of Missouri Extension: plants and their environment](https://extension.missouri.edu/publications/mg2)                             | Retain “Plants respire day and night.” Explicitly say the index does not subtract respiration.                                               |
| Direct controls and immediate visible response support exploration when their meaning is clear. | [PhET interview study, part II](https://phet.colorado.edu/publications/archive/PhET%20interview%20Paper%20Part%20II.pdf)                                                                                                                                                   | Keep sliders for optional exploration, but put prediction, fixed manipulation, evidence, and explanation together in the guided path.        |
| Package and UI code should not turn text into markup or executable code.                        | OWASP [DOM XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html) and [JavaScript/TypeScript Security](https://cheatsheetseries.owasp.org/cheatsheets/JavaScript_and_TypeScript_Security_Cheat_Sheet.html) cheat sheets | Use React/React Native text rendering and bounded package fields. Add no raw HTML, `eval`, dynamic code, persistence, or package capability. |

None of these sources validates a numerical availability scale, a universal
limiting-factor equation, or a prediction of plant growth. The shared model is
therefore documented as an invented comparison rule.

## All-string review

### Catalog and page frame

- **Title — “Leaf Energy Lab”:** retained because it names the subject without
  claiming measurement.
- **Summary:** now previews the specific comparison: extra light cannot replace
  water or carbon dioxide.
- **Question:** now asks whether light can replace water “as an input to
  photosynthesis.” This avoids treating a zero external-water setting as an
  instantaneous claim about a real leaf's internal water.
- **Tags, grade bands, and duration:** unchanged. They are catalog metadata, not
  teaching claims.
- **Registry explanation, experiment cards, misconception card, and decorative
  metadata line:** retained for catalog/API parity but suppressed on built-in
  lesson pages. The activity itself teaches and tests those ideas, so repeating
  them below it adds reading without adding evidence.
- **Sources:** retained in the accessible page footer with direct titles. Asset
  or research credit is not overlaid on the teaching visual.

### Guided challenge 1

- **Heading — “Test a missing input”:** names the concept rather than the UI.
- **Held-constant sentence:** names water 0 and carbon dioxide 80, then says to
  change only light.
- **Prediction choices:** use mutually exclusive outcomes, “activity stays at
  zero” and “more light restores activity.” They record a testable expectation,
  not confidence or a score.
- **Action:** runs a fixed 30-versus-100 light comparison. It remains gated
  until a prediction exists.
- **Evidence:** shows both settings and both indices, including the zero
  boundary. It does not rely on bar length or the leaf picture alone.
- **Feedback:** explicitly matches or differs from the selected prediction,
  then explains that light cannot substitute for water as matter.

### Guided challenge 2

- **Heading — “Find the limiting input”:** names the idea to infer.
- **Held-constant sentence:** fixes water at 35 and carbon dioxide at 80 and
  changes only light.
- **Prediction choices:** distinguish continued rise from leveling once water
  limits. The second challenge stays gated until challenge 1 is observed.
- **Evidence:** reports the 15, 35, and 100 light trials. The 35 setting names
  the light/water tie; the 100 setting names water as the model limit.
- **Feedback:** is state-specific for both prediction choices. It explains a
  rise followed by a plateau without claiming a real universal response curve.

### Visual and current state

- **Accessible visual name:** describes a schematic magnified leaf, the current
  toy index, and every tied limiting input.
- **Current-state readout:** exposes the index, all three settings, and all tied
  limits as text. Color, animation, and bar length are supplementary.
- **Diagram callouts:** retain leaf cell, chloroplast, stoma, and vein labels;
  the gas/transport key remains text-labeled. These identify structures tied to
  the explanation rather than adding a mood tagline.
- **Process note:** says light supplies energy, water and carbon dioxide supply
  matter for sugars, and released oxygen comes from water. A duplicate equation
  was removed from inside the canvas.
- **Scale note:** retains the necessary warning that the cutaway uses different
  display scales.

### Open comparison, limitations, and reset

- **Controls:** use “availability” or “setting,” never concentration units or a
  measured physiological quantity.
- **Comparison A:** stores all three settings and the index. The result names
  changed and held variables and flags a multi-variable comparison as
  uncontrolled.
- **Model note:** identifies the 0–100 result as a toy activity index, describes
  the lowest-response rule, and says it is not measured rate, sugar amount, or
  growth. It names omitted stored water, temperature, species, nutrients,
  stomatal behavior, and respiration.
- **Reset:** clears both predictions, both result panels, comparison A, and all
  open-control changes. No success score, points, praise animation, or arbitrary
  performance label is used.

### Runtime parity

- Web and native use the same bounded shared model and fixed trial constants.
- The downloadable package duplicates the same formula and lesson states
  locally because package workers are prohibited from importing application
  topic code. Package tests pin the shared 37/67/67 displayed evidence and the
  zero boundary so drift is visible without weakening the sandbox boundary.
- The package's comparison stores the complete trial, not only its resulting
  index.

## Verification record

Final commands, browser assertions, screenshot paths, and any honest gaps are
recorded after the implementation pass in
`docs/photosynthesis-refinement-verification.md` and the task report.
