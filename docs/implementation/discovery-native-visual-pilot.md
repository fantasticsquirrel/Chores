# Discovery Lab native visual rendering

## Scope and status

All 26 native explorations now use richer offline visual scenes while retaining
native controls, educational calculations, readable results, reset behavior and
fallback diagrams. Twenty-four use demand-rendered Three.js scenes. Optics and
Pattern use finite SVG variants generated from the same web artwork at build time.
Pattern has a tile view and a separate transformation view. This is implemented
coverage, not an Android/iOS device-verification or visual-parity claim.

The native models remain authoritative. Gravity compares two masses under the
same selected gravity, using the same computed fall distance. Optics retains
native air/water indices 1 and 1.333, not the web's default glass. Solar angles,
orbit points, circuit power, bridge reactions, river changes and ecological
states are calculated before crossing the visual boundary. Chance retains the
actual final random draw rather than guessing it from accumulated counts.
Castle sight-line overlays are off initially and after reset; explicitly enabling
them shows dashed rays, not structural cables. The leaf cross-section includes
scientific input/output callouts; the numeric result remains outside the scene.

The nine additions are Machine Workshop, Heat House, Pressure Tank, Moving
Plates, Cloud and Rain Lab, Magnetic Fields, Cell Explorer, Shape Slicer, and
Adaptation Island. Their deterministic models are shared with web, and their
React-free scene factories live in `packages/discovery-scenes/src/expansion`.
Each has native controls, readable evidence, reset, and two prediction-first
paired comparisons that restore the stated starting conditions. Numeric heat
flow can be zero or reversed; cell transfer preserves the compartment total;
shape controls include the exact diagonal-cube preset; island values are
expected percentages rather than sampled individual counts. Rendered symbols
are explicitly described as approximate where appropriate. The native adapter
replaces the web-only insulation drag label with a native-control instruction.

There are no scene title badges, mood taglines or decorative developer labels.
NASA attribution is in the existing Sources footer. A renderer failure leaves
an accessible diagram and the native controls/results available.

## Why this renderer

The installed app uses Expo 56.0.23 / React Native 0.85.3. The installed Expo SDK
module map and the official SDK 56 documentation specify:

- `react-native-webview` 13.16.1, installed exactly.
- `react-native-svg` 15.15.4, considered but not installed. It would require a
  second artwork implementation for the rich scenes.
- `expo-gl` ~56.0.6, considered but not installed. DOM/asset adapters and native
  GPU validation would broaden the migration. No `expo-three`, Skia or animation
  dependency was added.

Official references inspected:

- https://docs.expo.dev/versions/v56.0.0/sdk/webview/
- https://docs.expo.dev/versions/v56.0.0/sdk/svg/
- https://docs.expo.dev/versions/v56.0.0/sdk/gl-view/
- https://github.com/react-native-webview/react-native-webview/blob/master/docs/Guide.md

The WebView guide identifies local HTML-file loading inconsistencies. The app
therefore uses inline HTML with all JavaScript and images embedded, not a local
server, hosted page, CDN or file-URL loader.

## Source and package boundaries

`packages/discovery-scenes` owns shared Moon/landscape renderers and the bounded
transport schema. The nine expansion renderers also live in the shared package.
Other React-free scene builders remain under the web feature and are imported only by the native build script. There is no runtime import of
web components, React DOM, API clients or frontend routing into the native app.
`svg-atlas-source.jsx` uses React DOM server at build time to produce 34 optics,
32 tile and 8 motif variants; native controls choose a validated variant. The
native SVG instruction says to use controls, not to drag a noninteractive image.

`scenes:build` emits two local documents: WebGL approximately 1.82 MB and SVG
approximately 1.03 MB, about 2.85 MB combined. Only the appropriate document is
loaded by a scene surface. The script fails before writing any document over
2 MiB, includes full third-party license text, and `scenes:check` rejects stale
output. Generated output is committed for reproducible/offline app bundling.
After any upstream renderer change, rebuild both documents.

## Security and lifecycle

- Inbound state is a discriminated union of exact keys, bounded finite numbers,
  booleans and fixed enums. Arrays have bounded lengths; polygon/atlas states
  have finite allowed steps. Native serialization also has a 32 KiB ceiling.
- Outbound messages are only `ready`, `rendered`, `unavailable`, or a bounded
  numeric Moon angle. Unexpected keys, oversized strings, malformed JSON, URLs
  and arbitrary commands are ignored. Drag-to-angle events are limited to one
  per animation frame. Other native educational controls remain outside WebView.
- A hashed-script/hashed-style Content Security Policy denies connections,
  remote images, frames, workers, media, forms, object embeds and base URL changes.
- Inline HTML requires the library's wildcard origin whitelist; the separate
  navigation decision allows only the exact initial `about:blank` document.
  Remote navigation, file access, shared/third-party cookies, DOM storage,
  geolocation and media capture permissions are disabled. No account or child
  identifiers, auth material or private data enter the document or bridge.
- Fallback occurs after 12 seconds without rendered readiness, a reported
  render/texture failure, load error, or native renderer-process termination.
  It does not retry indefinitely. Native controls stay usable.
- Timers and GPU resources are cleaned up on unmount/pagehide. There is no
  continuously running animation loop or autoplay.
- The dependency's Android manifest adds no `uses-permission` entry. No app
  permission-setting change was made.

## Assets and notices

NASA LRO/LROC/LOLA source files are reused unchanged from
`frontend/src/features/discovery-lab/simulations/moon/assets/SOURCES.md`.
NASA Blue Marble texture provenance is in the space assets directory.
Other scenes use procedural geometry/textures. The complete Three.js MIT license
is embedded in generated scripts and copied to
`packages/discovery-scenes/THREE-LICENSE.txt`. No NASA endorsement is implied.

## Verification and remaining release gates

Keep these checks separate:

- Unit tests exercise every state kind, malformed values and navigation rules.
- Native Jest tests exercise all 26 model-to-scene handshakes, native controls,
  same-gravity semantics, no source reload, hardening flags, accessible fallback
  and bounded timeout. WebView is mocked; these are not rendering tests.
- Offline browser checks render the exact generated documents in sandboxed
  Chromium. They cover each WebGL scene and all 74 finite SVG variants, visual
  changes on state updates, Moon phase framebuffer checks, drag-to-angle
  messages, zero remote requests, CSP connection blocking, cleanup and WebGL
  failure. Captures at 390 px are document previews, not device screenshots.
- Expo's Android Metro/Hermes export checks JavaScript/assets and module imports.
  It does not build, install or run an APK.
- Native release still requires Android and iOS startup, loading latency,
  gesture/scroll interaction, screen readers, context/process loss, offline
  startup and repeated navigation checks. No device/emulator was available.
- A new native binary containing `react-native-webview` is required. This must
  not be an OTA-only update to an old binary lacking that module.

Commands: `npm run scenes:build --workspace mobile`,
`npm run scenes:check --workspace mobile`, shared renderer/native typechecks,
native full tests, frontend regression checks, and
`npm run scenes:test:browser --workspace mobile`. Native typecheck includes
freshness validation. The browser suite honors
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and keeps the sandbox enabled. This local
verification used the supported `/tmp/chromium` binary with the Chromium
sandbox enabled; it did not disable browser security or publish the artifacts.

## Recorded local verification (2026-10-24)

- Native unit suite: 291 passing tests in 30 files.
- Native UI suite: 463 passing tests in 53 suites, including all 26 offline
  model handshakes and exact Chance final-draw/reset behavior.
- Offline browser suite: 26 passing checks covering all 26 topics and all
  74 finite SVG states, including bounded label placement at 390 px, no
  unavailable drag instructions in native expansion scenes, and zero remote
  requests. All nine 390 px expansion document previews were visually reviewed.
- Native/shared typechecks and generated-document freshness checks pass.
- Android Metro/Hermes export: 886 modules, approximately 7.4 MB JavaScript
  bytecode. This is a bundle export only, not an APK or device result.
- Generated documents: 1,821,132 bytes WebGL and 1,030,560 bytes SVG, both
  below the 2 MiB per-document cap.
