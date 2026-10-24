# Discovery Lab: nine additional Explorations

## Scope and baseline

Implement the nine concepts approved after the initial 17-topic handoff, for 26
Explorations total. Archaeology (Dig Through Time) is expressly excluded.

This local branch starts from reviewed commit
`45be48eb17ee4f53bc583ec3b5875ecfa480f69f`. The first17 remain a separate publication
checkpoint. Implementation authority for these nine does not imply permission
to publish or merge them.

- Machine Workshop: ideal levers, pulleys and gears; force/distance tradeoffs.
- Heat House: matched conductive heat-loss comparisons.
- Moving Plates: boundary motion, terrain and simplified elastic stick-slip.
- Cloud and Rain Lab: cooling, moisture, condensation and droplet growth.
- Pressure Tank: hydrostatic head and ideal horizontal outlet flow.
- Magnetic Fields: compass direction, pole orientation and interaction.
- Cell Explorer: plant/animal structure and selective transport.
- Shape Slicer: exact plane intersections with modeled solids.
- Adaptation Island: inherited variation and population selection.

## Architecture and editorial constraints

Use the existing trusted registry, authentication/module gates and parent filters.
No new child data, tracking, external transmission or persistence is required.
Inside an explicitly enabled module, newly added pages retain the existing
default-enabled policy; parent overrides remain page-specific.

Keep numerical models in the shared API package and React-free procedural scene
builders in discovery-scenes. Web uses a shared responsive demand-rendered host;
native uses the same builders in hardened offline documents, with native controls
and readable results outside the renderer. Every new state crossing the native
bridge needs exact keys, finite bounds, allowed enums and negative tests.

Use the approved high-quality Moon/castle direction without forcing3D where it
obscures a concept. Visible labels must map forms and motions to actual concepts.
Each lesson needs two controlled predict-observe-explain investigations, accurate
model limits, and meaningful changes caused by its controls. Keep all prose
functional: no promotional taglines, decorative lab labels or developer chatter.

## Verification gates

- [x] Nine registry entries validated, sources and controlled investigations reviewed.
- [x] Boundary/model tests, including counterexamples and conservation/invariance.
- [x] All 26 web renderers and native controls registered and tested.
- [x] All 26 offline native states validated and renderer documents rebuilt.
- [x] Desktop/mobile captures reviewed for all new scenes and changed old surfaces.
- [x] Direct manipulation, touch, keyboard, reduced motion and GPU-loss fallback.
- [x] Server per-child/bulk access and direct-denial regression.
- [x] Full web/shared/native/backend regression, lint, builds, security and architecture.
- [x] Independent science/math/editorial/visual review and final package.

Native real-device/emulator/APK testing remains a separate release gate. No
publication, deployment, production migration or paid service is part of this
local expansion without further authorization.

Subsequent authorization: publish and normally merge the tested combined 26-topic
implementation into fantasticsquirrel/Chores master, then remove only its merged
feature branch. No deployment or paid CI run is included.
