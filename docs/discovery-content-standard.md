# Discovery Lab education-first content standard

## Mandatory rule

Education is the primary purpose of every Exploration, including its catalog
card, explanation, controls, artwork labels, result messages, accessible text,
guided experiments and parent-facing descriptions. Every learner-facing
sentence must do at least one useful job: teach a concept, identify evidence,
direct an achievable investigation, explain an observation, prevent a
misconception, or clarify a necessary model limitation.

Do not ship unnecessary AI or production commentary, self-congratulatory copy,
marketing claims, generic enthusiasm, decorative narration, repeated filler,
or claims that an activity is educational instead of actually teaching. Do not
replace explanation with points, badges, streaks, praise, competition or
reward language. A vivid title or an inviting illustration is welcome when it
helps learners approach the subject; it must not obscure the subject.

This is a release requirement for all 17 current Explorations and every future
addition or revision. It applies to authored and generated material equally.
It is an editorial and engineering standard, not a word blacklist: context,
scientific accuracy, instructional usefulness and the implemented experience
determine whether content passes. Structural tests cannot certify these
judgments. A change that fails the checklist below is not ready to release.

## Required instructional structure

1. **One answerable question.** State a concrete relationship the learner can
   investigate with the actual controls. Prefer “What changes when…?” over an
   invitation merely to explore or admire the scene.
2. **A causal explanation.** Name the important parts and explain how they are
   related. Introduce unfamiliar terms where used. Distinguish the real concept
   from the way this particular model represents it.
3. **At least two guided investigations.** Each must include a prediction before
   the change, a named action and comparison, a visible or accessible
   observation, and a question that asks the learner to explain the result.
   The prediction should be possible without reading the expected result first.
4. **A fair comparison.** Say what stays fixed, which variable changes, and when
   a reset is needed. For changing systems, compare equal starting states and
   equal elapsed steps. For probability, distinguish the theoretical chance
   from a finite observed sample.
5. **Evidence-based feedback.** Report what changed and what that supports, not
   only success/failure. Label units and distinguish measurements from relative
   indices, schematic values and invented teaching parameters. Do not imply
   precision or prediction that the model does not support.
6. **A misconception to test.** Correct a likely wrong idea and explain the
   distinction. Do not introduce a false universal in the process.
7. **Useful sources.** Link directly to supporting material from the originating
   scientific, heritage or educational institution, or reputable primary
   research. Open and inspect the actual source and the relevant claim, not
   merely the search snippet. Replace broken or unrelated redirects. Sources
   support the learning content; they do not validate invented model constants.

## Language and scope

- Write to the learner in direct, concrete language. Keep each paragraph focused.
  Define necessary vocabulary rather than replacing it with vague metaphors.
- Use instructions that match both web and native controls. If an action exists
  on only one platform, either implement it on the other or rewrite the shared
  activity around the common capability. Never promise unavailable audio,
  animation, drawing, measurements, settings or saving.
- Prefer observable relationships over trivia. Use numerical examples when
  they clarify a comparison, not to decorate the interface.
- Suggested grade bands describe the actual thinking and reading required.
  Younger learners may need a reading partner. Bands are browsing guidance,
  not curriculum certification or an assessment of a child's ability.
- Subject and tags must describe the concepts being taught and use existing
  vocabulary where useful. Do not attach unrelated tags to improve discovery.
- Time estimates describe an investigation, not an imposed countdown.
- Accessibility descriptions are part of the lesson. Describe the relationship
  or result as well as the picture; do not rely on color, sound or motion alone.
- Keep important model assumptions in the learner's view. “Simplified model”
  by itself is insufficient: say what is omitted or invented when that changes
  the conclusion a learner might draw. Do not remove these caveats as filler.
- History must identify the region and period when reconstructing a place.
  Label fictional composite settings and invented economics explicitly. Avoid
  portraying an entire culture or century as one homogeneous experience.

## Protected conceptual distinctions in the current collection

1. Orbit Workshop: orbit is falling under gravity; the baseline speed does not
   automatically increase when central mass changes. Distances are schematic.
2. Light Bending Studio: angles are from the normal; total internal reflection
   requires travel from higher to lower refractive index above the critical
   angle. Ray brightness is not a calculated energy split.
3. Gravity Drop Lab: mass is not weight; equal acceleration assumes a vacuum
   and uniform local gravity. Jupiter has no solid surface for this drop.
4. Solar System Explorer: eight planets, unequal distances and orbital periods;
   drawing sizes and gaps are not a common scale or today's sky positions.
5. Moon Phase Observatory: phases are changing views of the sunlit half, not
   Earth's shadow. The phase cycle is not the same as the sidereal orbital period.
6. Leaf Energy Lab: sugars are made using water, carbon dioxide and light energy;
   one resource cannot replace another. Activity is not a plant-growth forecast.
7. Castle Design Lab: a 13th-century English-inspired composite, not every
   castle. Route and sight-line comparisons do not predict a siege result.
8. Sound Playground: frequency and amplitude are different quantities; air-wave
   wavelength is not string-wave wavelength. Slow visible motion is not audio
   frequency, and an ideal fundamental leaves out real instrument overtones.
9. Bridge Builder: the beam-bending calculation and illustrative brace capacities
   are not a solved truss, a construction design or a safety certification.
10. River Sculptor: erosion transports material; deposited and exported sediment
    account for removed soil. Teaching coefficients are not flood forecasts.
11. Circuit City: energy is transferred while charge is conserved; opening a
    series path differs from opening a parallel branch. Fixed resistors and an
    ideal battery do not model household mains wiring.
12. Food Web Rescue: the three-group chain is part of a larger food web; more
    nutrients need not improve all populations. Oxygen and population indices
    and illustrative weeks are not field measurements or forecasts.
13. Fraction Feast: portions must refer to equal-sized wholes and equal pieces;
    equivalent fractions preserve an amount, and a sum may exceed one whole.
14. Pattern Palace: rotations and reflections preserve lengths and angles; a
    corner test uses 360° but alone cannot prove every proposed tiling extends
    across the plane. Regular and irregular polygons are not interchangeable.
15. Caravan Crossroads: trade involved networks and many communities, not a
    single one-way route. Locations, durations, prices and losses are fictional.
16. Pollinator Express: a visit is not necessarily compatible pollen transfer,
    fertilization or seed production. The single pollen load and flight reach
    are teaching assumptions, not universal bee or flower biology.
17. Chance Carnival: theoretical probability differs from observed frequency;
    independent trials do not make an overdue outcome more likely. More trials
    do not guarantee an exact or monotonically improving match.

## Required review checklist

The author and reviewer must check the finished experience, not just the JSON.
Record the checked topics, commands, findings and any remaining limits in the
change's verification notes. Do not mark an unchecked item as passed.

- [ ] The central concept and causal explanation are scientifically or
      historically accurate, and the cited source actually supports them.
- [ ] Every sentence earns its place under the mandatory rule above. Review
      catalog, detail, simulation, feedback, controls and accessible text.
- [ ] Both guided investigations have prediction, executable action, observable
      comparison and explanation; all are achievable on web and native.
- [ ] Boundary and counterexample cases were tried, not only attractive defaults.
- [ ] A controlled comparison or reset does not accidentally change other inputs.
- [ ] Labels, units, diagrams and result text agree with the actual calculation.
- [ ] Significant assumptions, omitted mechanisms and invented quantities remain
      visible. No claim exceeds the evidence or the model's scope.
- [ ] A nonvisual learner can obtain the meaningful result; no essential concept
      depends only on sound, color or continuous motion.
- [ ] Suggested grades, subject, tags and duration match the investigation.
- [ ] The complete registry and relevant math, interaction and platform tests pass.
- [ ] New content has a working simulation on both supported platforms; a
      registry entry or static illustration alone is not a completed Exploration.

Automated checks cover stable unique IDs, complete metadata and instructional
fields, source URL structure, deterministic model relationships and interaction
behavior. Human editorial review remains mandatory for meaning and clarity.

## Rendered-screen review

Review actual screenshots as well as registry copy. Decorative labels such as “Earth Observatory,” taglines such as “One Moon. A changing view…,” and redundant “experiment bench” labels do not teach a concept and must be removed. Retain state, control instructions, explanations, feedback, and necessary model caveats. Keep credits accessible in Sources or the footer, not over the teaching visual. Apply this check after every visual redesign so a richer rendering does not reintroduce filler.
