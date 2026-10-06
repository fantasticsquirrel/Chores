# Source-pinned dependency security backports

This is a temporary local mitigation, not an upstream release or an advisory
allowlist. Package versions stay braces **3.0.3** and node-forge **1.4.0**;
`npm audit` still reports their version-based advisories. The existing mobile
build-toolchain exception remains unchanged and still rejects these findings
when given the raw report directly. The separate source-aware mobile gate first
checks every actual installed copy's full hashes and exploit behavior, with its
root fixed to the real repository and caller root/module overrides cleared.
Only exact advisory sources 1240992 / GHSA-vfj7-8cjw-p6xm and 1240912 /
GHSA-86w9-cpqp-85rv, high severity, unchanged vulnerable ranges, and paths to
verified unchanged-version copies can be removed from an in-memory report.
Raw metadata must reconcile before normalization. Dangling edges and leafless
cycles fail; cycle-safe reachability prunes only ancestors no longer connected
to an advisory leaf. The remaining report must pass the unchanged exact
image-size exception. Unknown or changed advisories always fail.

The shell logs the original npm JSON and emits `source-backports-verified`, its
raw finding count, fixed advisory IDs, and the remaining image-size exception.
It does not claim zero advisories, a patched npm release, or release approval.
Even an image-only or clean report requires installed source verification.

## Provenance and scope

`vendor/security-backports/manifest.json` records the registry tarball URL and
lockfile SHA-512 SRI, plus SHA-256 of every original and patched package file.
The downloaded tarballs were checked against that exact lockfile SRI before
building these local artifacts. All shipped licenses are retained.

* node-forge: GHSA-86w9-cpqp-85rv. `lib/rsa.js` uses the real upstream patch from
  https://github.com/digitalbazaar/forge/pull/1152, commit
  `ceba34402e329f0365134f23fe19898756527d65`. Its nested DigestAlgorithm element
  count is checked against OID plus optional NULL. The two shipped browser
  bundles receive the identical count predicate; their now-stale source maps
  are removed. The full upstream patch is included, including its regression.
* braces: GHSA-vfj7-8cjw-p6xm. Local defensive backport, not represented as an
  upstream fix: parser nesting is capped at 127 open blocks; compile, expand,
  and stringify validate ASTs iteratively before recursion, rejecting depth
  over 128 or more than 65,536 visited nodes. The non-configurable limit includes
  parentheses and caller-provided ASTs. Ordinary globs/ranges retain behavior.
  Extremely deeply nested patterns now produce an explicit SyntaxError.

## Installation and verification

Root `postinstall` applies the backports after a lockfile install. The Git-index
regression verifies every patched file's exact bytes, including the browser
bundles that a global `dist/` ignore rule would otherwise omit. Vendored bytes
are exempted from Git text normalization, not from security verification. It accepts
only exact original or exact patched complete file manifests, validates all
nested and non-hoisted frontend/mobile/packages workspace copies before changing
any, and rejects unknown versions, modifications,
missing packages, and symlinks inside affected package trees. It rereads all
patched files and runs the malformed-input behavior regression for every copy.

```
npm ci
npm run security:backports
```

`--ignore-scripts` skips protection: a subsequent `npm run security:backports`
MUST reject the unpatched installation. Never skip this check in a build or
release job. Failed or interrupted installs must not proceed to a build.
Browser-bundle regressions are included in the test suite. The official RSA
fixture uses the upstream padding-check testing flag to isolate DigestInfo;
normal verification rejects it too. This is deterministic malformed-signature
coverage, not a claim that the fixture is a practical forgery with valid padding.

Rollback: revert the scoped change and reinstall with `npm ci`; that returns
these dependencies to vulnerable upstream sources and must block release until
an alternative mitigation or genuine patched upstream version is selected.
When official fixes are published, replace these source artifacts and tests
with verified upstream versions rather than retaining a permanent local fork.
