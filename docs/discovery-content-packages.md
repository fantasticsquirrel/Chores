# Authoring Discovery Lab content packages

A content package adds a versioned Exploration without editing the bundled
catalog or redeploying the application. It contains teaching metadata plus either
a bounded relationship model or an isolated custom simulation. Uploading is not
publishing; publishing is not permission for children to run it.

This guide complements [the education-first content standard](discovery-content-standard.md).
Read that standard before writing a lesson, then review the rendered experience.
The existing module system and its authorization remain unchanged.

**Platform support in this release:** both downloaded runtimes run on the web
only. Native mobile clearly marks packages as web-only and does not execute
them or present a nonworking simulation as playable. Existing bundled
Explorations retain their native implementations.

## Choose the smallest runtime that teaches the concept

- `declarative-v1`: one numeric input and a proportional, inverse, or linear
  relationship. No executable asset is needed. Use this for transparent
  comparisons and graphs, rather than inventing code unnecessarily.
- `worker-v1`: self-contained JavaScript computes a bounded vector scene and
  numeric controls inside a browser worker. Use it when a relationship graph
  cannot adequately represent the investigation. It cannot provide arbitrary
  HTML, navigation, third-party libraries, network calls, or native functionality.

This is a narrow exception to the module guide's prohibition on dynamic code
execution: reviewed Discovery computation runs only through this restricted
content runtime, never as a module plugin, app-main-thread script, backend
extension, or native-code loader. Adding a new runtime capability or native
feature still requires an application change, security review, tests, and release.
A package cannot change its own permissions or install dependencies.

## Copy and build an example

Run these commands from the repository root after installing the backend's
requirements in `.venv`:

```bash
.venv/bin/python scripts/discovery-packages.py build \
  docs/examples/discovery-packages/spring-force /tmp/spring-force-1.0.0.zip
.venv/bin/python scripts/discovery-packages.py build \
  docs/examples/discovery-packages/pendulum-period /tmp/pendulum-period-1.0.0.zip
.venv/bin/python scripts/discovery-packages.py validate /tmp/pendulum-period-1.0.0.zip
.venv/bin/python scripts/discovery-packages.test.py
node --test scripts/discovery-package-examples.test.mjs
```

The CLI uses the backend's actual validator, not a separate approximation. It
sorts file entries, fixes ZIP timestamps and permissions, and uses deterministic
compression settings. Identical source bytes produce identical ZIP bytes on the
same Python/zlib toolchain. Keep the resulting archive and printed checksum as a
release artifact. Rebuilding under a different compression library can change
the archive checksum without changing the asset checksums.

Copy an example directory outside the repository for a new lesson. Change both
`package_id` and `exploration.id`, choose a new version, write the teaching
content, and edit its model or worker. Do not put README files, editor backups,
ZIP outputs, dependency directories, secrets, or undeclared assets inside the
source directory. Write the ZIP outside that directory.

When an asset changes, update its declared hash explicitly:

```bash
.venv/bin/python scripts/discovery-packages.py checksums path/to/my-package
.venv/bin/python scripts/discovery-packages.py build path/to/my-package /tmp/my-package.zip
```

The checksum command updates only already-declared assets. It does not silently
add files or turn unknown content into trusted content. Add new assets to the
manifest with their exact MIME type first, then refresh checksums and validate.

## Manifest contract: schema version 1

The ZIP must contain `manifest.json` at its root, not a containing folder.
[Spring Force](examples/discovery-packages/spring-force/manifest.json) is a full
minimal working manifest. Required fields are:

- `schema_version`: integer `1`.
- `package_id`: stable lowercase slug, starting with a letter, up to 80
  characters; subsequent characters are lowercase letters, numbers, or hyphens.
  It must not collide with a bundled Exploration.
- `version`: `major.minor.patch`, optionally followed by a prerelease suffix,
  for example `1.0.0` or `1.1.0-preview.1`. Numeric core components have no leading
  zeros. Build-metadata suffixes (`+...`) are not supported. Maximum 60 characters.
- `runtime`: `declarative-v1` or `worker-v1`.
- `exploration`: the teaching fields below. Its `id` must equal `package_id`.
  Do not supply a `package` field; the server owns runtime/version annotations.
- `assets`: an array of `{ "path", "mime_type", "sha256" }` entries. Use an
  empty array when no files other than the manifest are needed. Do not list the
  manifest itself.
- Exactly one runtime definition: `scene` for a declarative package, or `entry`
  for a worker. `entry` must reference a declared `text/javascript` asset.

Unknown manifest fields are rejected. JSON must be UTF-8, with unique object
keys and finite numbers. The Python schema is
`backend/app/schemas/discovery_packages.py`; export its JSON Schema when building
an editor rather than maintaining a second schema:

```bash
PYTHONPATH=backend .venv/bin/python -c 'import json; from app.schemas.discovery_packages import PackageManifest; print(json.dumps(PackageManifest.model_json_schema(), indent=2))' > /tmp/discovery-package.schema.json
```

### Teaching fields

`exploration` includes `id`, `title`, `summary`, `subject`, `grade_bands`, `tags`,
`duration_minutes`, `question`, `explanation`, `experiments`, `misconception`,
and `sources`. Grade bands are `K-2`, `3-5`, `6-8`, or `9-12`; tags and grade
bands must be nonempty and unique. Duration is 1–180 minutes. There are at most 32 tags, four grade bands,
12 experiments, and 16 sources; unknown nested fields are rejected.

Each of at least two experiments has `title`, `instruction`, and `observe`.
Each source has `title` and a direct HTTPS `url` without embedded credentials.
All teaching content is bounded plain text, not HTML. Keep each string below
12,000 characters; avoid angle brackets and control characters.

Ask a prediction before revealing the result. Name the actual control to
change, what stays fixed, which observations to compare, and a question that
asks the learner to explain the evidence. Sources must support the concept,
not merely mention the topic. Source links are references for the learner;
validation does not fetch them, execute them, or certify their accuracy.

### Declarative scene

```json
{
  "kind": "proportional",
  "controls": [
    {
      "id": "stretch",
      "label": "Stretch",
      "min": 0,
      "max": 0.2,
      "step": 0.01,
      "initial": 0.05,
      "unit": "m"
    }
  ],
  "output": { "label": "Restoring force magnitude", "unit": "N" },
  "coefficient": 20
}
```

There is exactly one control. The host calculates `y = coefficient * x` for
`proportional`, `y = coefficient / x` for `inverse`, and
`y = coefficient * x + intercept` for `linear`. Defaults are coefficient 1 and
intercept 0; only linear scenes may have a nonzero intercept. An inverse input
range must not contain zero. Bounds and initial values must be finite and
within ±1,000,000; minimum must be below maximum, initial within the range, and
step positive and no larger than the range, with at most 10,000 intervals.
Calculated outputs must remain finite and within ±1,000,000,000,000.
Control IDs use lowercase slugs up to 40 characters. Labels are at most 120
characters and units at most 40. Explain signs, units, assumptions, and what
kind of quantity the output represents.

### Worker input and output

See the complete [Pendulum Period source](examples/discovery-packages/pendulum-period/pendulum.js).
It uses classic worker syntax, not ES modules:

```javascript
self.onmessage = ({ data }) => {
  self.postMessage({
    description: "One bob at the starting position.",
    shapes: [{ kind: "circle", x: 400, y: 240, r: 20, fill: "#f6c56a" }],
    controls: [],
  });
};
```

The host sends `{type, time, dt, width, height, values, control?}`. `type` is
`reset`, `control`, or `step`. Time is elapsed host simulation seconds; regular
steps have `dt: 0.05`, and other inputs have `dt: 0`. The view is 800 × 480. On narrow screens, the host’s Enlarge/Fit diagram control provides a horizontally scrollable full-size view while evidence and controls stay readable outside it.
`values` maps control IDs to current numbers; it starts empty, so supply defaults.
A control event includes the changed control ID. Reset must restore reproducible
starting state. Respond once promptly per input. The host provides pause/resume
and reset. A deterministic Time slider is also valid: the pendulum example uses
one so equal-time observations do not depend on reaction speed or motion.

Return an object with `description`, `shapes`, and `controls` (and optional
`buttons` for bounded actions and `animate` for time stepping):

- `animate`: optional boolean, defaults to `true`. Set `false` for deterministic
  slider-driven or turn-based models: the host stops automatic step ticks and
  hides Pause/Resume; control events and Reset remain available.
- `description`: nonblank plain meaningful evidence, at most 2,000 characters. It is both
  visible text and the drawing's accessible description, not a hidden substitute
  for an explanation.
- `shapes`: at most 256 primitives, each with `kind`, `x`, and `y`. Supported kinds:
  `circle` adds `r` and optional `fill`; `rect` adds `width`, `height`, optional
  `fill`; `line` adds `x2`, `y2`, optional `stroke` and line `width`; `text` adds
  `text`, optional `fill` and `size`. Colors are hex `#rgb` or `#rrggbb` only.
  Numeric values must be finite with absolute value no greater than 2,000;
  dimensions/radii cannot be negative, line width is at most 40, and text size
  is 6–80. Each text label is at most 200 characters. Use positive dimensions.
- `controls`: at most 12 `{id,label,min,max,step,value}` objects. IDs start with
  a letter and contain letters, numbers, underscores or hyphens, up to 40
  characters; IDs must be unique. Labels are at most 120 characters. Include
  units in labels. Numeric values use the same ±2,000 finite bound; step must
  be positive, minimum below maximum, and value within bounds.

Control and button labels must be nonblank; whitespace-only labels are rejected.

An optional `buttons` array supports at most 12 `{id,label}` actions; use stable,
unique IDs and short descriptive labels. Clicking one sends a `control` input
with its ID in `control`; the worker owns the resulting state change.

The serialized output is limited to 64,000 characters. Only the listed vector
properties are used by the host. There is no HTML/SVG-markup, path, URL, event
handler, image, font, audio, storage, or arbitrary component bridge. The entry
is self-contained: imports and network access are unavailable. Keep worker
source within 256 KiB (262,144 bytes); the server applies this stricter limit
to the worker entry, and the runtime also bounds decoded source length. Respond within 1.5 seconds;
a failed, hung, or invalid worker is stopped, not retried indefinitely.

## Assets and archive safety

Every non-manifest file must be declared exactly once. Each SHA-256 is 64
lowercase hex characters over the exact file bytes, not a text-normalized copy.
The server separately records a SHA-256 of the uploaded ZIP.

Allowed type/extension pairs are `text/javascript`/`.js`,
`application/json`/`.json`, `text/plain`/`.txt`, `image/png`/`.png`,
`image/jpeg`/`.jpg` or `.jpeg`, and `image/webp`/`.webp`. Images are decoded and
verified, with at most 4,000,000 pixels. UTF-8 text must not contain NUL; JSON
assets must also parse. Declaring a MIME type does not convert the file.
Accepted assets are not automatically renderable: worker-v1 currently exposes
only its entry script and vector protocol, not an image/asset-loading API.

Limits: 2 MiB compressed ZIP; 4 MiB expanded total; 1 MiB per asset; 128 KiB for
the manifest; 32 files including the manifest; expansion ratio at most 100:1
per file; a 256 KiB worker-entry limit; a 3 MiB upload request-envelope limit;
and 100 stored package versions per household. Only stored/deflated
ZIP entries are supported. Paths are relative ASCII names with letters,
numbers, underscores, hyphens, slash-separated directories, and lowercase file
extensions. Avoid spaces and dotfiles. Absolute paths, traversal, backslashes,
symlinks, special files, directory entries, encrypted ZIPs, duplicate entries,
undeclared files, and HTML/SVG assets are rejected. Archives are never extracted
or executed by the server. Do not put personal information or secrets in them.

## Upload, preview, publish, enable, and roll back

Once the runtime is deployed, subsequent packages require no application build:

1. Build and validate the ZIP locally. Complete the editorial/science checklist.
2. Sign in as a parent with Discovery Lab manage permission. Open the package
   management area and upload the ZIP. The stored version is immutable and not
   yet published. Child accounts cannot upload, preview unpublished versions,
   or publish. Household scope comes from the authenticated session, never from
   a manifest or user-supplied household ID.
3. Preview that exact version. Run every investigation, test minimum/maximum
   controls and reset, inspect the result with keyboard and screen reader, and
   review a narrow/mobile-width screen. Preview is not a security bypass and
   does not grant child access.
4. Publish the reviewed version. It becomes the household's catalog version,
   but children remain disabled for it until a parent explicitly enables that
   version for each intended child through Discovery access settings.
5. Sign in as an enabled child and confirm the actual lesson opens. Confirm a
   disabled child cannot fetch it even by direct URL. Check a separate household
   cannot see or run it. Keep the original ZIP and checksum with review notes.

For an update, keep the package ID and increment the version, then repeat the
same process. Uploading the same ID/version again is a conflict, even if the
bytes match. Publishing a different version clears existing package child
grants; re-review and enable the new version deliberately. Republishing the
already-current version does not reset grants. The server does not choose a
version by lexical order or automatically upgrade it.

To roll back, publish a previously stored, reviewed version. This is a pointer
change, not a mutation of an old artifact. Re-enable intended children after
rollback because changing versions clears grants. Do not edit a database blob,
reuse a version number, or patch a published ZIP in place. Back up database
package records with the application's normal database backup. There is no
package deletion/garbage-collection workflow in this initial contract; plan
version retention before reaching the household cap.

### API reference

Paths below are relative to `/chore-api`; normal cookie-session and CSRF rules
apply. Writes require the matching `X-CSRF-Token`. Use the authenticated app
client rather than copying session credentials into examples.

- `GET /discovery/packages`: parent-manage list of stored version summaries.
- `POST /discovery/packages`: JSON `{ "archive_base64": "..." }`, standard
  base64 of ZIP bytes, returns a created version summary (201).
- `GET /discovery/packages/{package_id}/versions/{version}`: authenticated
  parent preview payload `{manifest,assets,checksum}`. Each asset includes
  `path`, `mime_type`, `sha256`, and `content_base64`.
- `POST /discovery/packages/{package_id}/versions/{version}/publish`: publish
  that existing version; returns its summary.
- `PUT /discovery/children/{child_id}/access`: select `exploration_ids` and
  `enabled`. Enabling a package also requires `package_versions` mapping each
  selected package ID to its reviewed, currently published version, for example
  `{ "enabled": true, "exploration_ids": ["spring-force"],
"package_versions": { "spring-force": "1.0.0" } }`. A stale version is rejected;
  refresh and review rather than silently enabling a newer release. For a bulk
  subject/grade/tag selection, map every selected uploaded package; a missing or
  mismatched version rejects the whole enable operation with 409. Disabling or
  changing bundled Exploration access does not require a package version map.
- `GET /discovery/explorations/{exploration_id}/package`: authorized currently
  published payload, checked against effective module and child/version access.
  A parent's optional `child_id` preview remains scoped to their household.

The normal Exploration catalog includes published packages with a server-owned
`package` annotation containing version, runtime, and checksum. Do not use the
parent preview endpoint as the child's playback endpoint. Payload responses use
`Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

## Runtime security and compatibility

The backend remains authoritative for household, role, module, and child/version
access. Hiding an upload button or catalog card is not authorization. Publishing
is audited; it is not a signature that certifies the author's science or code.
Checksums detect changed bytes, not malicious or incorrect behavior.

Browser custom computation runs in a worker created by an opaque-origin iframe
with `sandbox="allow-scripts"` and a restrictive Content Security Policy. No
same-origin privilege is granted. Host messages check their source and a
per-runtime capability value. Network/resource loads are blocked; the worker
has no parent DOM, session-cookie API, native bridge, or arbitrary app API.
Untrusted output is validated and rendered with explicit host-owned primitives,
not injected markup. A response deadline limits hung computations. Browser
isolation is defense in depth, not a reason to skip code review or resource
limits; do not claim that it provides a hard process-memory quota.

Content does not include native libraries, WebAssembly plugins, React Native
bundles, or downloaded executable native code. A client that does not support a
runtime must show an explicit unsupported state, never execute it unsandboxed or
pretend that metadata alone is a working simulation. Schema/runtime versions
are capability contracts, not permission to assume compatibility. Test every
supported platform before claiming an Exploration works there.

Downloaded package permission is not permanent. The web client verifies access
when opening, on focus, and every 15 seconds during use, with a five-second
authorization timeout. It retains authenticated immutable content in a bounded in-memory cache
(up to four checksums and 3 MiB total), but that cache never stores permission.
The cache is identity-scoped and cleared when the runtime unmounts; it does not
survive navigation, logout or a browser restart. There is no persistent browser
storage cache: the raw ZIP digest cannot authenticate normalized cached JSON.
Preview also rechecks authorization. Offline state or a failed authorization
refresh must stop playback and show a reconnect/access message, not fall back to
cached permission or a previously fetched payload. Revocation is enforced on
subsequent server requests; an already-running online view may persist until its
next authorization check. Package content is not a secret after an authorized
user has received it; authorization controls future service access.

## Release checklist

- [ ] One answerable question and a causal explanation fit the actual controls.
- [ ] Both investigations require prediction, manipulation, observation, and
      explanation, with a fair comparison and a reproducible reset or time control.
- [ ] Equations, units, signs, edge cases, and visible values agree. Important
      assumptions are visible; fictional coefficients and schematic scales are named.
- [ ] Actual authoritative source pages were opened and the relevant claims
      inspected. Media licenses/credits, if any, are recorded in accessible Sources.
- [ ] Every sentence teaches, directs, explains evidence, or prevents a mistake;
      no production commentary, promotional labels, or reward mechanics replace learning.
- [ ] Results are available as text, not color/motion alone. Keyboard controls,
      labels, contrast, narrow screens, and reduced-motion use were reviewed.
- [ ] Code contains no external imports, requests, analytics, credentials, or
      unrelated functionality. Malformed output, timeout, reset, and pause work safely.
- [ ] ZIP validation and deterministic example tests pass. Parent/child/other-
      household, disabled module, unpublished, changed-version, and offline flows
      have been tested against the final client/server implementation.
- [ ] Preview was reviewed on every claimed platform. Record what was not tested;
      static checks alone are not editorial or visual acceptance.

### Example science review

Spring Force deliberately reports magnitude for a fixed, illustrative 20 N/m
ideal spring. The tested relationship is proportionality, not material failure
or a safe load. Pendulum Period uses the small-angle equation
`T = 2π sqrt(L/g)` and `angle(t) = 10° cos(sqrt(g/L) t)` with `g = 9.81 m/s²`.
Mass changes its marker size, not its period; marker size is explicitly schematic.
The curve, numeric period, cycle count and accessible position description give
several ways to compare evidence. Time is manually scrubbed, not measured by
wall clock. The 0.5 m and 2 m cases produce approximately 1.42 s and 2.84 s.

Sources inspected 2026-10-24:
[OpenStax: Hooke's law](https://openstax.org/books/college-physics-2e/pages/16-1-hookes-law-stress-and-strain-revisited)
for restoring-force direction and stiffness;
[OpenStax: Pendulums](https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums)
for the small-angle assumptions and length/mass dependence. Artwork and teaching
wording in these examples are original; the source figures are not copied.

## Troubleshooting

- **422 Invalid package:** read the detail. Check the root manifest, exact file
  list, hashes, MIME/extension pair, UTF-8, safe paths, and limits. Re-run the
  local validator; do not weaken the server's rules to accept an archive.
- **409 immutable version:** choose a new version; do not retry as an overwrite.
  A household cap conflict requires an operator retention decision, not endlessly
  increasing version numbers.
- **401/403:** sign in and check the actual parent role, module permissions, and
  CSRF token. Do not route around the access check with a preview URL.
- **Missing child lesson:** check published version, effective Discovery access,
  and the child's explicit approval for that version. New versions intentionally
  start disabled; a successful upload alone does not add a playable child lesson.
- **Worker fails or stops:** check UTF-8 source, entry path, source size, classic
  worker syntax, blocked imports/network calls, 1.5-second response budget, and
  the vector contract. `kind`, not `type`, discriminates a drawing primitive.
- **Sliders reset or disagree:** initialize from `data.values`, supply defaults
  only for missing values, and return stable control IDs. Respect `reset`.
- **Works online but not offline:** this is intentional for package authorization.
  Reconnect; do not persist an allowed flag or serve a cached authorized view.
- **Visual differs from teaching:** stop publication and correct the model or
  instructions. Passing structural validation does not make the lesson correct.
