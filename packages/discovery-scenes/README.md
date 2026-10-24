# Shared Discovery scenes

`@family-manager/discovery-scenes` provides DOM-hosted, demand-rendered visual
builders and the bounded offline-scene transport. The web app and native
scene-only WebView reuse exact source; this is not an Expo GL implementation.
No account, household, child, API client or storage belongs here.

- `./moon`: `createMoonScene(host, options)` takes local texture URLs and
  ready/unavailable callbacks, returning `setAngle(number)` and idempotent
  `dispose()`, or `null` when WebGL cannot start. It owns resize, local assets,
  lighting and GPU cleanup, uses a 1.5 DPR cap and renders only on demand.
- `./landscape/*`: procedural River, Pond, Caravan and Garden scene builders,
  shared state and a host lifecycle. Controls and model calculations stay outside.
- `./protocol`: exact-key typed/validated state for all 17 explorations, bounded
  messages and serialization, plus an exact local-navigation allowlist.
  Types, primitive guards and validation are split into focused modules.

Some pure builders currently live in the frontend feature. The native build
imports them at build time only. React DOM is used at build time for finite
Optics/Pattern SVG variants; it is not shipped inside either runtime document.
Canonical NASA images/provenance remain in the web Moon/space asset directories.
The native build reads these as data URLs. Procedural scenes require no fetches.

Run `npm run typecheck --workspace @family-manager/discovery-scenes` after edits.
After changing any shared/web source used by native rendering, run
`npm run scenes:build --workspace mobile` then
`npm run scenes:check --workspace mobile`. Each of the two generated documents
must stay below 2 MiB. Native typecheck automatically checks freshness.
`npm run scenes:test:browser --workspace mobile` verifies exact offline documents;
set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for a nondefault Chromium installation.
Browser tests keep its sandbox enabled and are not native-device tests.

See `docs/implementation/discovery-native-visual-pilot.md` for security,
licensing, verification and mandatory native-device release gates.
