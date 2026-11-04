# Magnetic Fields redesign verification

Review checkpoint: 2026-11-04 on `feat/discovery-learning-overhaul`, based on
`30b56348a0e53e16d9ead7bfa279c95be3bcbeab`. This checkpoint authorizes no merge,
deployment, publication or production change.

## Learning design and shared model

Web, native and the standalone package share one bounded exterior-field model
and two prediction-first investigations:

1. Reverse only the right bar while holding the edge gap and probe at `(0, 2)`
   fixed. The learner compares N-S attraction with N-N repulsion and the changed
   compass direction; the normalized field index is explicitly not force.
2. Keep N-N facing bars and the same gap, establish the exact midpoint null,
   then move only probe z from 0 to 2. The evidence shows two equal nonzero
   contributions canceling only at the midpoint and a nonzero vector sum away
   from it.

Each path gates the baseline on a prediction, reports correct or incorrect
feedback with numerical and visual evidence, explains the vector relationship,
clears stale evidence after manual changes, and resets. Bounds are 0.5-4.5
diagram units for the edge gap, -6 to 6 for probe x, and -4 to 4 for probe z.
The exact 2 by 0.8 diagram-unit bar footprint is shared by model and renderers.

The paired softened signed sources are a dipole-like numerical surrogate, not
magnetic charges. The capped 0-100 index is not tesla, force or a measurement;
diagram positions are not metres. The lesson excludes the field inside a bar,
Earth's field, nearby material, compass friction, bar motion, force magnitude
and full three-dimensional fields. Field lines are illustrative mapping marks,
not threads, material flow or particle paths.

## Scene, access and parity

The dimensional timber-edged tabletop, green measurement grid, brass compass
array, bar magnets, field traces and authored labels are preserved. The final
scene adds noncolor pole text, a shaped north-seeking probe end, exterior N-to-S
arrows, visible +x/+z axes, a null-state explanation, and responsive callouts.
Selecting the probe no longer reverses a bar. Web retains keyboard controls,
Home reset, opt-in replay and reduced-motion behavior. Native shares state,
trials, evidence and boundary text while its offline scene preserves the rich
tabletop. Package and web use the same model and scene serialization.

## Sources

The claim map and model provenance are in
[magnetic-fields-copy-research.md](magnetic-fields-copy-research.md). The host
read and preserved HTTP 200 responses for both cited OpenStax pages, the MIT
OpenCourseWare magnetic-field superposition chapter, and National MagLab's
compass mapping activity. Exact final URLs, byte counts and hashes are in
`sources/cited-source-manifest.json` beside the staged evidence.

## Browser and visual review

- Sixteen true-before web images and the report are staged under
  `/root/.openclaw/workspace/media/exploration-series/magnetic-fields/before/`.
  Report SHA-256: `01776a7bcd80b96af7c0fb20419d70e768e3789f9c77563658379d8a1fce1c37`.
- The final web matrix has 44 desktop/mobile initial, operated, feedback,
  motion, boundary, full/component/scene/viewport records with zero browser
  errors, failed requests, external requests, overflow or recorded overlaps.
  Report: `/tmp/magnetic-fields-host-after/final-report.json`; SHA-256
  `8d690b3743f1d2f7ff277c0c7b773d1fe57e3fd3fbd984968af5a8d7ccdfb532`.
- The final standalone-package matrix has 40 records, including a strict mobile
  heading/intro-versus-label overlap assertion. It records zero product browser
  errors, failed requests or external requests. The expected opaque-iframe
  service-worker denial remains isolated and the sandbox was not relaxed.
  Report: `/tmp/magnetic-fields-final-package/package-report.json`; SHA-256
  `8455d049bdbe8140a4f95862f61a7d7c8072995cc112c909ccaaed5f8edc2336`.
- The native offline image is staged at
  `native/offline-magnetic-fields-chromium-390.png` with all nine labels,
  including +z; SHA-256
  `e062372b0bcc03de6485c70b38ee260fd9da6f5b26c466fee7eba045f7ca0b70`.
- Browser runs used `/usr/bin/google-chrome`, `chromiumSandbox:true`, UID/GID
  65534 with isolated writable HOME/XDG, blocked service workers and loopback
  fixtures. Grid navigation used `visibility:hidden`, not `display:none`.

The essential before/final desktop and mobile scenes plus final package and
native images were inspected. Pole, compass and axis labels remain readable;
the package mobile introduction no longer collides with scene labels.

## Verification ledger

Definitive logs are under `/tmp/exploration-series-magnetic-fields/logs/` and
copied to the staged media logs. Focused model, scene, web, native and package
tests passed before the broader sequence below.

| Check                               | Result                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Frontend full test                  | 890/890, 161 files                                                       |
| Broad rich-package test             | 48/48 immediately after frontend                                         |
| Shared API gate                     | 602/602, 50 files                                                        |
| Native unit / UI                    | 296/296 and 534/534                                                      |
| Native offline browser              | 28/28, including all 74 bounded SVG states                               |
| Isolated backend/security selection | 61/61                                                                    |
| Physical package tests              | 23/23                                                                    |
| Modules / architecture              | 10/10; zero boundary violations                                          |
| Lint / format / build / typechecks  | pass                                                                     |
| Security checks                     | backports 51/51; audit contract 1/1; frontend runtime 0 vulnerabilities  |
| Determinism                         | byte-identical worker/manifest regeneration and two identical valid ZIPs |

The mobile runtime audit still reports seven raw low version-based advisories;
the existing source-backport verifier passes and reports no remaining findings.
This is not a zero-advisory result. No physical-device or real screen-reader
session was performed, and native/package chrome is not pixel-identical to web.
