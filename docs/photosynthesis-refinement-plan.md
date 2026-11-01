# Leaf Energy Lab refinement plan

Date: 2026-11-01

Branch: `feat/discovery-learning-overhaul`

Verified starting commit: `e0912bac6c4568620a7aa33d4f460b67488c588f`

## Selection evidence

The real built SPA was opened at 1440 × 1000 and 390 × 844 against the
isolated SQLite fixture at `/tmp/learning-module-fixture/chore_tracking.db`.
The Paper & Pine theme and authenticated production route were used; the
fixture is not identified in learner-facing UI.

Circuit City already gives state-specific current, voltage and power readings,
and makes the series/parallel distinction operative. Sound Playground already
coordinates frequency, pressure-cycle and relative-energy representations with
working comparisons. Leaf Energy Lab has the largest teaching gap: its only
interaction is three sliders plus a rate-only snapshot.

Baseline evidence is under
`/tmp/ui-captures/second-exploration/2026-11-01/`. Candidate component captures
are named `candidate-circuit-desktop-*` and `candidate-sound-desktop-*`.

## Blunt audit before implementation

### Learning flow and functionality

- The prompt asks for a prediction but the UI neither records nor gates on one.
  There is no feedback tied to what the learner expected.
- “Save comparison” stores only the current number. It discards the light,
  water and carbon-dioxide settings, so the learner cannot tell what changed or
  what stayed fixed.
- The two guided investigations live below the simulation as prose. The model
  never establishes their starting conditions, preserves their evidence or
  explains their observed result.
- Free slider movement can change several variables at once. Nothing identifies
  an uncontrolled comparison.
- Reset restores slider defaults, but there is no staged lesson state to reset.

### Scientific model and copy

- Web and native use different models. Web includes carbon dioxide; native
  holds it suitable and models only light and water.
- The current limiting-resource reducer reports only one resource when two or
  three tie. Equal settings silently prefer an array-order winner.
- The model does not clamp or reject non-finite inputs. Its `rate` reaches only
  80 at a setting of 100 while the UI presents it as “/ 100,” and its invented
  response curve is not explained.
- “Relative activity” is better than “growth,” but still sits close to language
  about production without saying that the number is a toy activity index, not
  a measured photosynthetic rate, sugar amount or growth forecast.
- The diagram equation treats “light” like matter. It should name light energy.
  If oxygen provenance is taught, it must say that the released oxygen comes
  from water.
- The existing copy correctly says that water and carbon dioxide are inputs,
  extra light need not help, and plants respire day and night. Those distinctions
  must remain while duplication is removed.

### Visual, mobile and accessibility

- The polished leaf cutaway dominates the stage, while the only quantitative
  evidence is a small line below it. The picture behaves more like ornament
  than explanatory evidence.
- Diagram labels and legend text become very small on mobile. The sticky app
  navigation crosses the long stage between the leaf and its controls.
- The canvas has an accessible summary, but it reports only one index. It does
  not expose held constants, tied limiting resources or the comparisons a
  nonvisual learner needs.
- Native has a basic leaf state and two controls but no equivalent guided lesson.

## Inspected source bodies

- [OpenStax Biology 2e, 8.1](https://openstax.org/books/biology-2e/pages/8-1-overview-of-photosynthesis)
  describes water and carbon dioxide as substrates, light as the energy source,
  sugars as products and stomata/chloroplasts as relevant structures.
- [OpenStax Biology 2e, 8.2](https://openstax.org/books/biology-2e/pages/8-2-the-light-dependent-reactions-of-photosynthesis)
  explains that photosystem II extracts electrons from water and releases
  oxygen during water splitting.
- [Royal Horticultural Society: plant gas exchange](https://www.rhs.org.uk/advice/understanding-plants/how-plants-breathe)
  explains that plants photosynthesize and respire in daylight, while
  respiration continues without photosynthesis overnight.
- [University of Missouri Extension: plants and their environment](https://extension.missouri.edu/publications/mg2)
  distinguishes photosynthetic carbohydrate gain from respiratory loss and
  explicitly states that respiration occurs day and night.
- The [PhET interview study, part II](https://phet.colorado.edu/publications/archive/PhET%20interview%20Paper%20Part%20II.pdf)
  reports that controls must be readily usable, and that sliders with immediate
  response and direct manipulation generalize well across simulations. The
  planned guided states retain immediate sliders for open investigation while
  placing prediction and evidence next to the controlled action.
- The [OWASP DOM XSS guidance](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
  and [JavaScript/TypeScript guidance](https://cheatsheetseries.owasp.org/cheatsheets/JavaScript_and_TypeScript_Security_Cheat_Sheet.html)
  require safe text sinks and reject string-to-code execution. The refinement
  will use normal React text rendering only: no raw HTML, dynamic code, new
  network input, persistence or expanded package authority.

These sources support the biological and interaction claims. They do not
validate the activity’s invented availability settings or index curve.

## Planned implementation

1. Add a shared, bounded photosynthesis teaching model to `family-api` for web
   and native. It will return a 0–100 toy activity index, all tied limiting
   resources, and normalized inputs. The saturating curve is explicitly an
   invented rule, not an empirical rate equation.
2. Replace the web worksheet-plus-sliders flow with two stateful investigations:
   a zero-water comparison at fixed carbon dioxide, then a low/equal/high-light
   comparison at fixed water and carbon dioxide. Each requires a prediction,
   runs a fresh controlled setup, preserves the evidence and gives
   prediction-specific explanation.
3. Keep the botanical cutaway, but put its index, inputs, process and limiting
   resource beside the interaction. Increase small labels and expose the same
   result in text.
4. Retain an optional three-slider investigation. A full settings snapshot will
   name the changed variable and held constants; changing multiple variables
   will be called out as an uncontrolled comparison.
5. Add a dedicated native Photosynthesis activity with the same shared model,
   predictions, fixed comparisons, feedback, three-resource controls and reset.
6. Fold the complete lesson into the activity on web and native, suppressing
   duplicated registry explanation cards while retaining concise Sources.

## Test-first and verification plan

Before implementation, add failing tests for:

- zero, clamped and non-finite inputs;
- two- and three-way limiting-resource ties;
- saturation without claiming measured proportionality;
- prediction gates, fixed conditions, state-specific feedback and reset;
- full comparison snapshots and one-variable/held-constant reporting;
- native parity and the carbon-dioxide control;
- keyboard activation, focus, mobile overflow and browser errors.

Then run the focused shared/frontend/native tests, complete content/registry
tests, frontend lint/build, mobile typecheck/tests, module validation, available
security gates and `git diff --check`. Final visual review will use matched
initial and completed screenshots at 1440 × 1000 and 390 × 844.

## Implemented result

The activity now follows the planned prediction → controlled experiment →
observation → explanation sequence on web, native and in the offline package.
The shared model reports a bounded teaching index and every tied model limit;
the interfaces identify changed and held settings, preserve numerical evidence,
and explain the model's non-empirical limits. The optional open investigation
remains available after the two guided comparisons.

Verification, browser assertions, review findings and honest gaps are recorded
in [photosynthesis-refinement-verification.md](photosynthesis-refinement-verification.md).

## Final supervisor closure

The lazy-route test was checked against the exact starting commit in an
isolated detached worktree rather than being classified from source history.
The baseline passed the focused route file and its complete 822-test frontend
suite. The delivered test now waits for the named Suspense fallback to finish
before retaining all original interactivity assertions; the final focused run
passed all four route tests.

Mobile evidence was also recaptured at ordinary scroll positions. Separate
390 × 844 challenge-one and challenge-two screenshots keep each complete card
above the fixed navigation, and the revised operated comparison uses those full
panels. Exact filenames, element/navigation bounds and the complete second
feedback are recorded in the verification report.
