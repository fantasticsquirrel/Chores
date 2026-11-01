# Chance Carnival learning overhaul plan

Date: 2026-11-01

Branch: `feat/discovery-learning-overhaul`

Verified starting commit: `74236840063f04384e06ec3fa2c473e1766b7b0c`

## Selection method

The selection was based on the real built Family Manager SPA, authenticated
against a SQLite backup in `/tmp/learning-module-fixture/chore_tracking.db`.
The backup came from the already-isolated
`/tmp/family-manager-cleanup-fixture/chore_tracking.db`; it is not live data.
The temporary capture wrapper only signed in and redirected to the actual
Discovery route. No fixture explanation was rendered in product UI.

Four production explorations were opened at 1440 × 1000 and 390 × 844 in the
Paper & Pine theme. Their real interactive components, registry content, shared
models and native counterparts were also inspected. Scores use a 1–5 scale,
where 5 means the finished experience provides strong, independently usable
evidence for that dimension.

| Exploration | Hierarchy | Interaction | Scientific accuracy | Progression | Misconceptions | Feedback | Accessibility |
|---|---:|---:|---:|---:|---:|---:|---:|
| Orbit Workshop | 4.5 | 4 | 4.5 | 3.5 | 4.5 | 4 | 4 |
| Gravity Drop Lab | 4 | 4 | 4.5 | 3.5 | 4.5 | 4 | 4 |
| Fraction Feast | 4.5 | 4.5 | 4.5 | 3.5 | 4.5 | 4 | 3.5 |
| **Chance Carnival** | **3** | **3** | **4** | **1.5** | **4.5** | **2** | **2.5** |

Evidence contact sheets:

- `/tmp/ui-captures/learning-module/2026-11-01/selection-desktop-components.png`
- `/tmp/ui-captures/learning-module/2026-11-01/selection-mobile-components.png`

## Why Chance Carnival was selected

Chance Carnival is the clearest case where polished visual production conceals
a weak lesson. The brass spinner is attractive and the probability model is
mostly sound, but the learner is given a dashboard plus a worksheet rather than
an investigation with consequences.

### Visual critique

- The oversized spinner consumes most of the first viewport while the evidence
  that should answer the question is a pale secondary card. The visual hierarchy
  says “watch the pointer,” even though the comparison of theoretical and
  observed shares is the concept.
- The page begins with large unused beige space and ends with dense text. The
  most important causal explanation is visually detached from the result it is
  meant to explain.
- Desktop chart captions are only 10 px; several mobile labels are 8–10 px.
  Those are not acceptable reading sizes for a grades 3–8 investigation.
- At 390 px, the sticky application navigation crosses the chart while the
  evidence card is in view. The module also stacks into a very long page with
  controls, a disconnected three-column worksheet, a readout and a caveat.
- Outcome color helps scanning, but the interaction never shows a sequence of
  recent trials. A learner cannot inspect a streak even though “overdue”
  thinking is the named misconception.

### Educational critique

- The prediction buttons are dead-end toggles. They change fill color and
  nothing else: the learner can run trials without predicting, receives no
  response tied to the choice, and never has to explain the evidence.
- “Run 10,000 more” does not create a controlled comparison. It adds to whatever
  sample and whatever weights happen to be active, then discards the earlier
  gap. The learner must remember the old value, and may unknowingly change both
  sample size and probability distribution.
- The screen says larger samples usually have smaller relative differences,
  but it displays only one current sample. It neither preserves the small
  sample nor acknowledges the scientifically important counterexample when a
  particular larger run is not closer.
- The second registry investigation—double one weight and reason that its chance
  is 2/5, not 1/2—has no scaffold or feedback in the simulation. It is a sentence
  below the first activity, easy to skip and impossible for the UI to verify.
- The initial state shows a blank graph and three generic control groups before
  establishing what must stay fixed. Free exploration arrives before the fair
  comparison.
- What the module already gets right must be preserved: chance is weight divided
  by total weight, zero weight is impossible, fairness describes the process
  rather than a small result, trials are independent pseudorandom draws, and a
  finite sample cannot prove fairness.

## Planned transformation

### 1. Make evidence, not ornament, the visual center

- Keep the real spinner/die render, but rebalance the top composition so the
  theoretical-versus-observed chart and current setup are equally prominent.
- Add a readable recent-outcome strip. It will expose streaks without implying
  that the next outcome is due.
- Raise chart, caption and control text to readable sizes and add mobile spacing
  so evidence is not hidden behind persistent navigation.
- Use the existing Paper & Pine material language; this is a structural learning
  redesign, not a generic cosmetic reskin.

### 2. Replace the dead worksheet with two stateful challenges

Challenge 1: fair process, uneven sample

1. Require a prediction: “all four counts must match” or “the counts can differ.”
2. Run a fresh 12-trial sample with four fixed equal weights.
3. Report the actual counts and the largest theory–observation gap.
4. Preserve that snapshot, then run a fresh 1,200-trial sample with the same
   weights.
5. Show both gaps side by side and explain what this particular comparison
   supports. If the larger sample happens not to be closer, explicitly say that
   this is possible and that the long-run tendency is not a guarantee for every
   pair of samples.

Challenge 2: weights and total probability

1. Require a prediction for doubling outcome 1 while all other weights remain 1:
   2/5 (40%) or 2/4 (50%).
2. Run a fresh sample with weights `[2, 1, 1, 1]`.
3. Explain that the numerator and total both matter, then compare the observed
   share with 40% without treating sampling variation as failure.

The open-ended device, outcome, weight and batch controls will remain available
after the guided work in a clearly named disclosure. Changing a probability
will still clear incompatible evidence.

### 3. Share the scientific mechanics

- Add a deterministic-testable shared draw-sequence helper and derive counts
  from its actual outcomes. The web recent-trial strip and final pointer will be
  two views of the same draws.
- Preserve `sampleOutcomes` as a compatible shared API while implementing it via
  the new helper.
- Cover zero-total weights, zero trials, exact cumulative boundaries, last-bin
  fallback and count conservation.

### 4. Keep web and native learning aligned

- Add the same required predictions, 12-versus-1,200 controlled comparison,
  doubled-weight challenge, state-specific feedback and model limits to the
  native Chance exploration.
- Keep platform-appropriate visuals and controls, but do not promise an action
  available only on web.

### 5. Strengthen the authored content and sources

- Tighten the two registry investigations around the executable challenge
  states and explicitly name fixed variables, fresh samples and the explanation
  question.
- Retain the existing Illustrative Mathematics standard and add inspected
  OpenStax sources for long-run relative frequency and trial independence:
  - https://openstax.org/books/introductory-statistics/pages/3-1-terminology
  - https://openstax.org/books/introductory-statistics/pages/3-2-independent-and-mutually-exclusive-events

### 6. Verification and evidence

- Write failing behavior/model tests before implementation.
- Test challenge progression, prediction gating, controlled fresh samples,
  state-specific explanatory feedback, keyboard operation and 390 px rendering.
- Run affected frontend, shared model, native and registry tests, then frontend
  lint/build, mobile typecheck/tests, module validation, dependency/security
  gates that exist in this checkout, and `git diff --check`.
- Perform an OWASP-oriented diff review for unsafe HTML, URL construction,
  persistence, authorization, randomness claims and denial-of-service risks.
- Capture matched before/after full-page and `.discovery-experiment-stage`
  images at 1440 × 1000 and 390 × 844 in Paper & Pine. Capture both the initial
  state and the same prediction-plus-12-trial state, inspect the pixels, iterate,
  and create final comparison sheets.

## Success criteria

The overhaul is complete only when a learner can predict, run two controlled
comparisons, read the result without relying on color, receive an explanation
tied to the observed data, test the named misconceptions, and repeat equivalent
work on native mobile. The final screenshots must show the shipped component,
not a recreated mockup.
