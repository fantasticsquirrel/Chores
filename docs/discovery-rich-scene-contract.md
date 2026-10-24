# Rich Discovery package scenes: worker-3d-v1

`worker-3d-v1` is an explicit capability version, not a metadata wrapper around a
bundled simulation. Old servers reject this runtime. The upgraded client requires
validated 3D output, rather than silently drawing an empty vector scene. Ordinary
`worker-v1` remains vector-only with its 64,000-character output budget.

A one-time application upgrade installs the trusted generic renderer and server
runtime allowlist. Afterwards, an author can publish new scene geometry, materials,
procedural textures, controls, evidence, guided investigations and camera presets
within this contract without rebuilding the app. New rendering capabilities still
require another application change. Packages cannot install dependencies.

Web only: native apps explicitly report packages as web-only. Existing bundled
native Explorations, including Castle, remain unchanged. WebGL must be available;
this proof does not recreate the original Castle-specific 2D fallback. When WebGL
fails, an explicit unavailable notice and textual evidence remain. Never describe
that state as equivalent visual playback.

## Authoring the Castle example

The independent authoring directory is `scripts/castle-package/`. It contains the
castle geometry, terrain, procedural masonry, route calculations, controls and
teaching actions. Its tiny scene recorder produces data; it does not import Three,
React, DOM APIs, network APIs, or the bundled app's Castle implementation.

```
node scripts/build-castle-package.mjs
node --test scripts/castle-package.test.mjs
.venv/bin/python scripts/discovery-packages.py build \
  docs/examples/discovery-packages/castle-defenses /tmp/castle-defenses-1.0.0.zip
.venv/bin/python scripts/discovery-packages.py validate /tmp/castle-defenses-1.0.0.zip
```

The author build uses the repository's existing esbuild. The output ZIP contains
only the manifest and a self-contained worker. Updating the authoring sources and
rebuilding that worker/ZIP is a **package build**, not an application build. Change
`version`, review the render and lesson, then upload, preview, publish, and approve
the exact new version for each child. Do not overwrite immutable package versions.
The independent package ID is `castle-defenses-package`, so it cannot replace or
hide the original bundled `castle-defenses`.

## Transport and execution

Input is the same bounded control/reset protocol as vector workers. Set
`animate:false`; 3D is demand-rendered on deliberate interactions, not a free-running
animation API. Output is limited to 524,288 serialized characters; worker entry
source remains limited to 262,144 bytes and each response has a 1.5-second deadline.
The package executes only in the existing opaque-origin sandbox worker. No
session, cookies, household identity, credentials or authoring secrets are sent.
The host validates data and allocates trusted Three objects itself. There is no
ObjectLoader, package callback, shader, HTML/CSS, DOM, URL, import or texture-loader
bridge. No downloaded package code runs on the app's main thread. An independent
750 ms heartbeat with a 1.5-second deadline also terminates a worker that returns
one valid scene and then loops forever while no user input is pending.

Output contains normal `description`, `controls`, `buttons`, empty `shapes`, and
required `scene3d`. `description` is concise nonvisual evidence, not decorative
copy. Optional `sections` provide up to four teaching blocks with a heading, text,
and referenced button IDs; `footnote` carries essential model limitations. These
are plain text. Buttons may indicate `pressed` state. Controls may be numeric
ranges, `kind:"toggle"` with 0/1 bounds, or `kind:"select"` with bounded numeric
options and plain labels. Returned control values are authoritative after actions,
so a guided comparison updates both the scene and visible inputs. The host bounds
queued deliberate inputs; reset clears pending controls and restores initial state.

## Scene description

The authoritative TypeScript shape is
`frontend/src/features/discovery-lab/packages/scene3d/types.ts`; runtime checks are
in `parseScene3D.ts`. Unknown scene/material/geometry properties are rejected.
No arbitrary properties are spread into Three or DOM objects.

- `nodes`: nested `group`, `mesh`, and `line` objects with explicit numeric
  position/rotation/scale, visibility/shadow flags, children and material IDs.
- `geometry`: box, cylinder, torus, circle, icosahedron, bounded line points,
  or a fixed-depth extrusion built from moveTo/lineTo/absarc/closePath commands.
  There is no shader, arbitrary buffer, triangulation extension or asset URL.
- `materials`: named standard/basic/line/dashed materials, numeric RGB colors,
  bounded roughness/metalness/transparency/bump parameters and texture references.
- `textures`: bounded rectangle drawing commands with strict hex colors, fixed
  dimensions, repeat and anisotropy. Alpha compositing preserves masonry marks.
- `camera`: orthographic target/radius/orbit/zoom/framing and named presets.
  Host implements drag, arrow keys, plus/minus zoom and Home. Camera stays in place
  during controls and design reset, like the original; Home resets the view.
- `lighting`: hemisphere plus bounded directional lights; at most one shadow map.
- `labels`: plain labels anchored at authored 3D positions and projected by host.
- `presentation`: instructional title, subtitle, route evidence and three validated
  gradient colors. Arbitrary CSS/layout code is not accepted.

Resource ceilings include 1,024 nodes, depth 16, a conservative 150,000-triangle
budget, 64 materials, four textures with 524,288 pixels total, 8,192 texture
rectangles total, 128 points per line, 64 commands per extrusion, bounded primitive
segments, eight camera presets, 12 labels, three directional lights and a single
shadow map up to 2,048 square. Backing canvas dimensions are bounded. Numeric
bounds also prevent nonfinite values, degenerate camera ranges and compounded
transform overflow. These are conservative bounded work limits, not a claim that
untrusted JavaScript can never consume memory before the browser terminates it.

## Castle educational review

The scene preserves the fictional 13th-century English-inspired composite, not a
specific reconstruction or a siege predictor. Ditch width is schematic. The cyan
dashed sight-line overlay starts off and resets off; its label explicitly says
it is not structures. Structural bridge elements remain distinct from that overlay.
Gate/route comparisons preserve the 22 m ditch; visibility comparisons keep route
and ditch fixed. Both investigations ask a prediction and an explanation.

Sources reopened and inspected on 2026-10-24:
- [English Heritage: Castles through time](https://www.english-heritage.org.uk/castles/castles-through-time/)
  for historical variation and castle functions.
- [English Heritage: Carisbrooke teachers' kit](https://www.english-heritage.org.uk/siteassets/home/visit/places-to-visit/carisbrooke-castle/school-visits/carisbrooke-castle_teachers-kit_2023.pdf),
  pages 34–36, for curtain walls, gatehouse, portcullis, ditches and wall walks.
  Its actual gatehouse is not claimed to be this fictional composite.

Geometry and artwork are retained from the repository's original Castle, not
copied from these sources. Source material supports historical concepts; it does
not validate the invented dimensions or predict military outcomes.
