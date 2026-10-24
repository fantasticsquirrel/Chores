# Castle rich package conversion proof

Scope: one independently authored web package, leaving bundled Castle and all
native implementations available and unchanged. No publication to production,
remote push, merge or deployment is included in this proof.

Baseline: master merge 0af1f2cc15b91691eeb30c7ec65b9ae07ee137f1.

- [x] Inspect the original scene, package runtime, architecture and teaching rules.
- [x] Identify that vector-only package output cannot preserve rich Three visuals.
- [x] Add a generic bounded 3D description contract and trusted renderer, with
      no package DOM/network/shader execution or arbitrary Three object loading.
- [x] Move geometry, textures, materials, controls, routes and teaching logic to
      independent package authoring sources; produce an importable ZIP.
- [x] Test malformed packages and aggregate rendering resource limits.
- [x] Independently compare actual original/package desktop and mobile renders
      with matched cameras and controls, inspecting screenshots and pixel diffs.
- [x] Prove local fixture upload/publish/version approval and changed scene and
      interaction from a subsequent package version without rebuilding the app.
- [x] Run applicable frontend/backend/shared/native gates, document honest
      restrictions and parity gaps, and prepare delivery/recovery artifacts.

The renderer extension is a one-time application upgrade. Later packages within
its explicitly bounded capability contract update independently. This is not a
promise that arbitrary existing code, native features or future renderer features
can be added without application changes.

Final evidence and disclosed limits: `docs/castle-package-verification.md`.
