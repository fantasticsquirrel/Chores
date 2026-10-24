# Rich, independently published Explorations

The collection in `docs/examples/discovery-packages/` contains all 26 current
Explorations as independent packages. The original bundled web/native activities
remain present. Package creation does not upload, publish, enable, deploy or
release anything. The collection deliberately uses `original-id-package` IDs.

## Authoring and package-only updates

Each topic in `scripts/exploration-packages/<original-id>/` owns its geometry,
models, interaction state, lessons and image assets. The Castle proof retains
its independent `scripts/castle-package/` authoring directory. Shared author
utilities record bounded scenes and controls; they do not call host topic code.
Three constructors may be bundled into the worker, but no package dependency is
downloaded or installed by a child client. All images are inside the archive.

Build just one topic, independently of the application:

```sh
node scripts/build-exploration-packages.mjs moon-phases
.venv/bin/python scripts/discovery-packages.py build \
  docs/examples/discovery-packages/moon-phases /tmp/moon-phases-1.0.0.zip
.venv/bin/python scripts/discovery-packages.py validate /tmp/moon-phases-1.0.0.zip
```

Omit topic arguments to build all 26. The builder rejects missing topic workers
instead of generating placeholders, rejects app-source runtime imports, copies
declared local assets, preserves the Three license and calculates checksums.
Its optional `exploration.json` merges topic-specific teaching instructions with
the existing metadata. Every displayed action must match actual package controls.

For a new immutable version, create/update the topic's `version.json`, for example
`{"version":"1.1.0"}`, then rebuild only that topic and its ZIP. Review its math,
visuals, feedback and license notices before upload. Castle's version remains in
its author manifest. These are package builds, not `npm run build` app builds.
Versions cannot be overwritten on the server.

## Capability contracts

- `declarative-v1`: existing bounded relationship exercises.
- `worker-v1`: existing vector shape protocol and 256 KiB worker source limit.
- `worker-3d-v1`: Castle's bounded procedural 3D contract, 256 KiB source and
  512 KiB frame. Its optional validated `fallbackVector` preserves the original
  package-owned castle plan when WebGL cannot render the primary view.
- `worker-rich-v1`: exact geometry buffers/allowlisted analytic shapes, physical
  materials, local raster textures, animation/resource reuse, mixed vector views,
  pointer actions, structured readouts and gesture-only audio. Source limit 1 MiB;
  serialized and fully reconstructed frame limit 4 MiB.

The new contract requires a one-time application upgrade. Future compatible
topic changes need no application rebuild. A new rendering capability still
requires an app upgrade. Unknown capabilities fail explicitly; they never select
an unrelated built-in activity. Native apps do not execute downloaded packages.

## Bounded execution and rendering

Package code runs only in an opaque-origin sandbox worker, without identity,
session credentials, storage, network or dependency-loading access. The host
validates structured output before constructing explicit trusted Three/React
primitives. There is no ObjectLoader, package-provided shader, HTML, callback or
main-thread executable bridge. SVG-like vectors are an allowlist of bounded
nodes/attributes with local definition references only, not raw injected SVG.

Rich archive limits are 8 MiB compressed and 12 MiB expanded. Legacy archives
retain 2 MiB/4 MiB limits. Every file remains at most 1 MiB, manifest 128 KiB,
with at most 32 archive entries and a maximum compression ratio of 100. The
request body is bounded to 12 MiB before JSON parsing. Raster images have
validated MIME, SHA-256, dimensions, maximum 4 million pixels each and a combined
16,777,216-pixel budget before browser decoding. Unsupported raster encodings
fail rather than fetching replacements. NASA sources and Three notices remain
in package assets and the accessible sources/caveats.

Rich scenes are bounded by 2,048 nodes, depth 16, 150,000 explicit buffer vertices,
a separate conservative 900,000 generated-vertex allowance, 900,000 geometry
indices and 300,000 drawn triangles, plus bounded materials,
textures, lights and shadows. Resource reuse may omit unchanged arrays only
after an initial validated snapshot; the merged scene must pass the same bounds.
Reset, identity/payload changes and teardown clear prior resources. The renderer
reuses topology and GPU resources for animation rather than rebuilding shadow
maps on every tick. Hidden pages pause ticks and in-flight frames coalesce.

Audio can start only from a visible user button. Tones are bounded to 40–2,000 Hz,
two seconds, gain 0.15 and sine/triangle waves. Sound is never the sole evidence.
Pointer events carry bounded numeric coordinates/rays or validated pick IDs;
equivalent controls remain available for keyboard and nonvisual use.

Independent response deadlines/heartbeats terminate stalled workers. There is
no hard per-worker heap quota available from the browser: bounded inputs/outputs
and watchdogs reduce, but cannot eliminate, memory-pressure risk.

## Catalog and child permissions

Built-in bookmarks keep their original routes and do not silently load new code.
The web catalog groups an available `*-package` alternative alongside its
available original with an explicit downloaded-version link. This is presentation
only: both entries must already have passed backend access checks. If an original
is disabled or filtered out, grouping cannot manufacture its link or access.

Import → preview → publish → approve the exact version for each child. New
packages start denied. Updating or rolling back clears grants and requires
review/reapproval. Built-in overrides are unchanged. Household isolation remains
server-enforced. Downloads are memory-cached only and authorization is rechecked
online; offline, logout, identity changes and revoked permissions stop execution.
No durable Discovery progress currently exists to migrate; local experiments
reset on remount. Do not treat copied metadata as migrated learner progress.

## Verification

The detailed initial migration plan is
`docs/plans/2026-10-24-all-exploration-packages.md` and its three family appendices.
Use the final verification report for actual results, not this architectural
description. Source completeness, parser success, visual parity and app-level
permission/update verification are separate gates. Run full backend/frontend/
shared/native gates after integration, plus package author suites and isolated
browser tests. `frontend/e2e/discovery-all-packages.spec.ts` exercises all topics
at desktop/mobile sizes and their independent v1 → v2 → rollback flows without
changing application build hashes. Renderer-family harnesses compare original
geometry, cameras and actual screenshots. Never run smoke seed scripts against
production databases. No hosted CI, push, merge or deployment is implicit.
