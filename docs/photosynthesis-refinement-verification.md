# Leaf Energy Lab refinement verification

Date: 2026-11-01

Branch: `feat/discovery-learning-overhaul`

Starting commit: `e0912bac6c4568620a7aa33d4f460b67488c588f`

## Delivered learning flow

- Challenge 1 records whether the learner expects extra light to restore the
  index when water is zero. It then compares light 30 and 100 while holding
  water at 0 and carbon dioxide at 80.
- Challenge 2 records whether the learner expects three light settings to keep
  increasing the index. It then compares light 15, 35 and 100 while holding
  water at 35 and carbon dioxide at 80, exposing the equal 67/67 result at the
  last two settings and the tied water/light model limits at 35.
- Feedback responds to the selected prediction, identifies the observation and
  connects it to the limiting-input idea without awarding points or presenting
  the activity index as plant growth.
- Open investigation retains all three resource controls. Saved comparisons
  preserve the full settings, name changed and held settings, call out
  multi-variable comparisons, and handle all-zero and tied-limit states.
- Reset restores the shared defaults and clears every prediction, evidence row,
  explanation and saved comparison.

The index is explicitly an invented, bounded classroom rule rather than a
measured photosynthetic rate, sugar quantity or growth forecast. The activity
states that plants respire day and night, distinguishes light energy from the
water and carbon-dioxide matter inputs, and says that released oxygen comes
from water. It does not claim empirical proportionality.

## Platform and package parity

| Surface         | Verified implementation                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared model    | Finite 0–100 normalization, continuous saturating response, all tied model limits, comparison changed/held metadata, fixed lesson constants                                                                          |
| Web             | Two prediction-gated controlled challenges, numerical evidence and bars, prediction-specific feedback, open comparison, reset, accessible botanical cutaway                                                          |
| Native          | Same shared model and fixed challenges, three-resource open controls, full comparison settings and held/changed values, reset and concise model note                                                                 |
| Offline package | Mirrored local formula within the package security boundary, prediction gates, invalidated downstream evidence after an upstream prediction change, completed snapshot, continuous response rounded only for display |
| Registry        | Concise question, experiments, explanation, misconception response and inspected sources aligned with the activity                                                                                                   |

The package intentionally mirrors the deterministic formula instead of
importing application code, preserving its isolated worker boundary. Existing
Chance files and behavior were not changed.

## Automated verification

Passed checks:

- Photosynthesis and adjacent web suites: 5 files, 57 tests.
- Native focused suites: 15 Jest assertions and 13 model/scene Vitest
  assertions; mobile TypeScript typecheck passed.
- Shared API gate: 29 files, 481 tests.
- Education/model regressions: 2 files, 15 tests.
- Module validation: 2 files, 10 tests.
- Backend discovery tests using
  `/tmp/second-exploration-pytest.db`: 52 tests.
- Exploration-package security/backport gate: 51 tests, with generated package
  artifacts verified.
- Architecture report: zero boundary violations; the lesson orchestrator stays
  below the report's 350-line hotspot threshold after a cohesive presentation
  extraction.
- Frontend lint and production build.
- Exploration-package rebuild for `photosynthesis` (381,993 bytes, two assets).
- `git diff --check` and a scan of touched code for `dangerouslySetInnerHTML`,
  `.innerHTML`, `eval` and `new Function`.

The first delivered-commit root frontend run completed 828 of 829 tests and
left `DiscoveryRoutes.test.tsx` on the “Opening Exploration…” Suspense fallback
past Testing Library's default one-second content lookup. Final review did not
treat unchanged source as proof that this was unrelated. In an isolated
detached worktree at the exact starting commit
`e0912bac6c4568620a7aa33d4f460b67488c588f`, the route file passed 4/4 by
itself, and the complete baseline frontend suite passed 145 files and 822 tests
in 191.51 seconds. The delivered commit's focused file also passed 4/4 before
the test adjustment. There is therefore no reproduced baseline failure to
record, and the earlier “fails alone/unrelated” characterization is withdrawn.

The actual fragility was a test-readiness boundary: the assertion asked for
content behind a lazy route within one second, even while the UI correctly
showed its explicit loading fallback. The Photosynthesis renderer is mocked in
this route test, so its expanded component is not mounted or behaviorally under
test, but transform and lazy-import completion still vary with process load.
The test now observes “Opening Exploration…,” waits up to five seconds for that
specific fallback to be removed, and only then makes the original synchronous
assertions that the slider is enabled, the read-only wrapper is absent and the
input changes to 7. The adjusted focused run passed 4/4; the lazy-route case
took 2.016 seconds, directly demonstrating why the one-second lookup was not a
reliable readiness signal. No product timeout, route behavior or functional
assertion was relaxed, and unrelated suites were not rerun on the delivered
tree.

The production build reports its existing Rollup chunk-size and dependency
annotation warnings; they are warnings, not failures. No APK, deployment or
physical-device verification was performed. The security gate also retains its
existing version-based npm-audit advisory notice; this change adds no dependency
and widens no exception.

## Browser and accessibility verification

The actual built SPA was exercised through its authenticated route using only
the isolated backup fixture
`/tmp/learning-module-fixture/chore_tracking.db`. No production database or
production path was read or written.

The scripted Playwright pass verified at desktop 1440 × 1000 and mobile
390 × 844:

- prediction gates begin locked and evidence is absent;
- radio choices and lesson actions work with Enter and Space;
- the zero-water comparison stays at zero at both light settings;
- the 37/67/67 low/equal/high sequence and its tied/plateau explanation appear;
- open comparisons report held settings and multi-variable changes;
- carbon dioxide at zero is exposed as a model limit;
- reset clears lesson and comparison state and restores defaults;
- the document and activity stage have no horizontal overflow;
- visible instructional text is at least 12 px; and
- no page, browser-console or failed-response errors occur.

The mobile layout was visually iterated so the guided work precedes the large
botanical visual. Controls keep 44 px minimum targets, evidence is available as
text as well as bars, and the canvas has an accessible summary. These checks do
not claim verification on a physical device or assistive-technology matrix.

## Visual evidence

True pre-edit and final full-page captures remain in:

`/tmp/ui-captures/second-exploration/2026-11-01/`

The set includes initial and operated/completed full-page and component images
for desktop and mobile. Candidate Circuit City and Sound Playground captures
are in the same directory. The original mobile guided element capture, where
the fixed navigation crossed the second feedback paragraph, is retained as
`after-completed-mobile-guided-obscured-original.png`; it is not used as final
evidence.

Final mobile challenge evidence was recaptured at the normal 390 × 844
viewport after scrolling, without CSS or product changes:

- `after-completed-mobile-challenge1-focused.png`: card top 16.3 px, card
  bottom 504.5 px, fixed-navigation top 782.2 px.
- `after-completed-mobile-challenge2-focused.png`: card top 16.5 px, card
  bottom 544.8 px, fixed-navigation top 782.2 px.

Both cards are fully above the navigation. The second capture visibly includes
the complete feedback: the index rises from 37 to 67, light and water tie at
35%, and the index stays 67 at 100% light because water limits the model. The
complete card captures are composed vertically in
`after-completed-mobile-guided.png`; raw before and final mobile full pages were
not replaced.

Readable before/after sheets and selected captures for handoff are staged in:

`/root/.openclaw/workspace/media/second-exploration/`

The staged set now includes both focused viewport captures, the complete guided
panel composition, and copies of `before-operated-mobile-full.png` and
`after-completed-mobile-full.png`. `paired-operated-mobile.png` uses the
complete guided panels and accurately labels the baseline “saved index only;
setup not saved” against the final “controlled evidence + full feedback.” The
stages are intentionally not identical because the refinement replaces an
unguided snapshot with gated predictions and preserved evidence.

## Editorial and independent review

Every learner-facing string family and the exact inspected source bodies are
listed in [photosynthesis-copy-research.md](photosynthesis-copy-research.md).
The independent review found no science or security blocker and identified
four useful refinements that were applied: downstream package evidence now
invalidates when its first prediction changes; native saved comparisons include
complete settings and held/changed values; the mobile guided work comes before
the dominant illustration; and “limiting resource” was replaced with the more
precise in-model phrase “model limit.” The reviewer also prompted explicit
coverage for a wrong prediction, all-three-resource ties and continuous
internal package calculations.
