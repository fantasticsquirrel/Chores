# Dependency security source backports and upstream admission

The repository uses two distinct fail-closed controls for dependency security:

1. exact upstream artifact admission for reviewed patched releases; and
2. source-verified local backports only when no secure upstream release exists.

Neither control is an advisory allowlist. Unknown audit sources, changed
advisory identities, unreviewed package bytes, consumer-graph drift, and
symlinks in protected dependency paths stop installation or the mobile audit
gate.

## Reviewed upstream artifacts

`scripts/verify-secure-upstream-artifacts.mjs` admits these exact artifacts:

| Package | Version | Scoped consumers |
| --- | ---: | --- |
| `node-forge` | 1.4.2 | Expo CLI and Expo code-signing certificates |
| `glob` | 14.0.2 | Expo CLI, config, config plugins, fingerprint, Metro config, and `test-exclude` |
| `minimatch` | 11.0.1 | Expo fingerprint, `glob@14.0.2`, and `test-exclude` |
| `zod` | 4.6.7 | Expo CLI |
| `test-exclude` | 8.0.0 | Babel Istanbul |

The root overrides are parent-scoped and exact. The verifier pins each
registry URL and SHA-512 integrity from `package-lock.json`, requires npm lock
format 3, resolves every reviewed edge from the actual installed consumer, and
matches the resolved path back to the exact lock entry. It rejects floating
overrides, changed versions, URLs or integrities, absent/duplicate expected
consumers, resolution outside the repository, noncanonical dependency
symlinks, and unreviewed changes to the consumer topology. The only admitted
dependency symlinks are exact root `node_modules` links for packages declared
by the root workspace manifest; both scanners traverse each canonical target
and deduplicate it by real path. The reviewed graph includes the exact
`glob@14.0.2` to `minimatch@11.0.1` edge and rejects drift in that nested copy
even when the other admitted minimatch copies remain unchanged.

`scripts/security-upstream-consumers.test.mjs` exercises APIs actually used by
Expo and React Native tooling: Expo certificate creation/signing, Expo CLI Zod
schemas, Expo glob wrappers, sync router discovery, array-pattern template
discovery, config bare-workflow detection, config-plugin iOS/Android extglob
discovery, Metro package discovery, fingerprint nested `.gitignore` discovery
and path matching, and Babel Istanbul `test-exclude` instrumentation. The
node-forge suite also keeps the retired local DigestInfo exploit regression
against the Node and browser bundles and covers invalid GCM tags, large first
OID arcs, and the negative-modulus inverse hang. The minimatch malicious
pattern runs in a bounded child process.

The former complete `node-forge@1.4.0` vendored package is intentionally
removed. Its replacement was accepted only after the exact `1.4.2` artifact
passed the old exploit regression, the additional malformed-input regressions,
and Expo's real certificate consumer.

## Source-verified backports

`vendor/security-backports/manifest.json` records the exact registry tarball
URL, lockfile SHA-512 integrity, and SHA-256 of every original and patched file.
The installer validates every installed copy's complete file manifest before
changing any copy, applies only reviewed overlays, rereads the full patched
manifest, and runs malicious-input behavior checks for every copy.

- `braces@3.0.3`, source 1240992 / GHSA-vfj7-8cjw-p6xm: the existing bounded
  nesting and AST-node backport remains unchanged.
- `deepmerge@4.3.1`, source 1243505 / GHSA-gcqx-w48m-w2h4: no patched npm
  release exists. The three published JavaScript entry points receive the
  property-name guard from upstream proposal
  [deepmerge PR 274](https://github.com/TehShrike/deepmerge/pull/274), commit
  `c5ad573121574db1c625b0aabcc6114ed7df6c5a`. Regression coverage includes the
  advisory's null-prototype target, null target placeholder, own target
  `__proto__`, and nested array-element payloads, plus ordinary nested merging.

The deepmerge overlay is deliberately narrow: the installer checks hashes for
all eleven package files but vendors only `index.js`, `dist/cjs.js`, and
`dist/umd.js`. A downgrade to `4.1.1` was rejected because the null-placeholder
prototype-confusion payload remains exploitable there even though that version
falls outside the current npm advisory range.

The source-aware mobile audit gate may normalize only those two exact sources
after installed source verification. Raw audit metadata must reconcile first;
package, GHSA, range, severity, nodes, and dependency paths must match exactly.
It then removes only graph ancestors that are no longer reachable from a real
advisory leaf. The unchanged image-size build-toolchain review is evaluated on
the remainder. Unknown sources, malformed/dangling graph edges, and leafless
cycles fail closed. Mixed raw severities are accepted only because the exact
deepmerge source is low severity; severity is still checked per advisory.

## Installation and verification

Root `postinstall` applies and verifies source backports, then verifies the
reviewed upstream artifacts and their installed consumer edges. A build must
not proceed after an interrupted or failed postinstall.

```bash
npm ci
npm run security:backports
bash scripts/audit-mobile-runtime-dependencies.sh
```

`--ignore-scripts` intentionally skips the protections and is not valid for a
release install. The Git-index regression verifies the exact bytes of every
vendored full package or overlay, including files under globally ignored
`dist/` paths. Security tests reject tampering, extra files, missing packages,
wrong versions, nested/workspace copies with different bytes, and affected
package symlinks. Isolated fixtures also reject symlinked package ancestors,
prove canonical workspace targets are scanned by both controls, and tamper
only the minimatch copy nested under `glob@14.0.2`.

Rollback means reverting the scoped overrides, lockfile, admission verifier,
and source overlays together, then performing a clean install. That rollback
restores vulnerable inputs and therefore blocks release until another reviewed
mitigation exists. When deepmerge publishes a fixed release, replace the local
overlay with the same exact-artifact admission process and keep its malicious
regressions.
