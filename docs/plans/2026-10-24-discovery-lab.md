# Discovery Lab implementation plan

Base: `587f81a8cb9d045593fcb2feb9aa2f9a2fea51a1` on `master`.

## Product contract

Discovery Lab is a Family Manager module. Individual learning pages are called
**Explorations**. The original seven-topic checkpoint covered orbital mechanics,
reflection and refraction, gravity, the solar system, Moon phases,
photosynthesis, and castle defenses. The approved implementation scope is now
**17 Explorations** on web and native; the ten additions are listed below.

Each pairs an interactive visual with an answerable question, prediction,
controlled observation, explanation and misconception check. These are learning
models, not engineering, astronomical prediction, environmental forecasting or
historical reconstruction tools; meaningful scale and model limits stay visible.
Education is the primary purpose. The hard no-filler rule in
[`discovery-content-standard.md`](../discovery-content-standard.md) applies to
all 17 lessons and future revisions, including rendered and accessible text.

## Access and privacy

- Existing and new households must opt into the module. Missing household rows
  do not grant access. Existing role/module, ownership, session and CSRF guards
  remain authoritative.
- Within an enabled module, a child has access to each Exploration by default.
  A persisted per-child/per-Exploration override takes precedence.
- Bulk actions resolve the current catalog using AND-combined filters and write
  individual overrides for the matched entries. They are not persistent rules:
  later individual or bulk writes win for the same entry, while unmatched
  entries remain unchanged. New Explorations inherit the enabled default.
- Parents manage only their own household's children. Children may read only
  their own allowed catalog and details; direct URLs/API requests do not bypass
  a disabled Exploration.
- No child analytics, grades, telemetry, external account or third-party child
  data transfer is introduced. Learning progress is intentionally not stored.

## Original seven-topic checkpoint

These tasks were completed before the expanded visual-quality revision. Their
checked state records that checkpoint, not the final status of the 17-topic
worktree.

- [x] Authoritative shared content registry and accurate learning prompts.
- [x] Backend schemas, module opt-in migration, scoped access service and APIs.
- [x] Shared typed API models and endpoints.
- [x] Seven interactive web simulations with tested deterministic mathematics.
- [x] Web catalog/detail/parent-control routes and responsive design.
- [x] Native catalog/detail/parent-control screens and interactive learning.
- [x] Security, contract, UI, scientific-math and migration regression tests.
- [x] Browser verification at desktop and Android-sized mobile viewports.
- [x] Independent review and aggregate checks for the original checkpoint.
- [x] Operator/developer documentation and reviewable local delivery.

The original seven are checkpointed at
`222fb654bd80adc75694d9cb462034ab6702369a`.

## Approved expansion to 17 Explorations

Additional topics: Sound Playground, Bridge Builder, River Sculptor, Circuit
City, Food Web Rescue, Fraction Feast, Pattern Palace, Caravan Crossroads,
Pollinator Express and Chance Carnival.

- [x] Add ten registry lessons with instructional fields and source links.
- [x] Establish the durable education-first/no-filler content standard.
- [x] Implement ten web models and shared mathematical functions.
- [x] Implement ten native interactive models with native controls/results.
- [x] Integrate all 17 into catalog, access settings, route/screen dispatch and
      contract/interaction tests.
- [x] Verify the initial expanded schematic collection at desktop and 390px
      mobile-browser viewports, including persisted parent/child access behavior.
- [x] Complete independent all-content editorial/source and rendered-experience
      review, with no blocking findings. Keep this separate from user acceptance.

## Approved visual-quality revision

The user approved the Moon/castle direction, requested that every lesson receive
comparable consideration, and clarified that unnecessary flavor/meta text must
be removed. Castle sight-line overlays must be off initially and after reset.

- [x] Replace the initial diagram-only treatment across all 17 with considered
      topic-specific compositions, rather than uniformly forcing 3D.
- [x] Implement 15 lazy WebGL exhibits and exact planar Optics/Pattern workbenches.
- [x] Keep scene state separate from educational calculations; retain numerical
      readouts, meaningful controls and model caveats.
- [x] Add demand rendering, bounded pixel density/resource cleanup, reduced-motion
      behavior, explicit playback and accessible fallback paths.
- [x] Implement direct manipulation where meaningful, with equivalent ordinary
      controls: orbit/ray adjustment, bridge/string movement, circuit switches
      and fraction slices.
- [x] Remove the reported Moon/shell flavor copy and use concept/state/action
      labels rather than branding or production commentary.
- [x] Make castle sight rays opt-in, dashed and reset to off; add regressions.
- [x] Integrate richer offline visuals into all 17 native lessons using the same
      scene sources or build-time SVG artwork, with bounded validated transport.
- [x] Inspect topic-group desktop/mobile-browser captures and correct reported
      composition, contact geometry, contrast and selected-state defects.
- [x] Pass focused Moon, physical and tactile browser suites, including actual
      mouse/touch manipulation and changed-state evidence where applicable.
- [x] Pass the consolidated all-17 authenticated desktop/mobile browser suite
      after the renderer/test corrections, including meaningful scene changes,
      persisted parent/child access and direct child API denial.
- [x] Complete independent manual inspection of all 34 desktop/mobile captures.
- [x] Finish independent science/history/accessibility/no-filler review; no
      blocking findings remain.
- [x] Complete the final coordinated local automated gates, including native
      offline scene/state checks, freshness and export validation.
- [ ] Deliver the reviewable local handoff; do not label it a published release.
- [ ] Verify richer visuals on Android and iOS devices/emulators. Browser-sized
      screenshots, offline HTML browser checks and mocked WebView tests do not
      establish native-device visual parity.
- [ ] Obtain final collection-wide visual acceptance. Directional approval of two
      examples is not blanket approval of the complete collection.

See [`discovery-visual-quality.md`](../implementation/discovery-visual-quality.md)
for all 17 renderer families and the current verification boundary, and
[`discovery-native-visual-pilot.md`](../implementation/discovery-native-visual-pilot.md)
for native security/lifecycle and device release gates.

## Verification

Use focused failing tests before implementation, then adjacent and full gates:
backend pytest, module manifest validation, shared API tests, frontend lint/tests/
build, native typecheck/tests/dependency checks, offline-scene build/freshness and
browser checks, security backports, fresh migration and Alembic check, strict
architecture report, and `git diff --check`.

The current visual-revision pass has a passing frontend lint run, 600 frontend
tests, 429 shared tests, 10 manifest tests, 792 backend tests and a production
TypeScript/Vite build. The 25 security checks and three-scenario original
application smoke suite also passed.
The architecture report has zero boundary violations but retains existing
unrelated hotspots. Dedicated tactile desktop/touch and physical interaction
suites passed. The consolidated all-17 authenticated desktop and 390px browser
journeys also passed both scenarios, including scene changes and persisted
parent/child access enforcement. Native checks passed 280 unit tests, 424 UI
tests, all 17 exact offline scenes and 74 SVG variants, type/freshness checks and
Android Metro/Hermes export. Independent visual/editorial review reports no
blocking findings after reviewing all 34 topic captures; actual GPU context
loss was verified, and mobile optics readability, context-loss handling and
Food Web fair-comparison instructions were corrected. Local implementation/review is complete, while native-device checks,
user collection-wide visual acceptance and any separately authorized release
process remain open.

Browser smoke must use a fresh isolated database and loopback-only local server.
No production credentials or data may be used. Distinguish passed, failed,
pending and not-run gates. Any renderer source change used by native requires
regenerating and checking the offline documents before native gates can pass.

Publication, merge, deployment, paid services and production changes remain
outside this task's current authorization. Nothing in this plan declares a
release or grants permission to publish.
