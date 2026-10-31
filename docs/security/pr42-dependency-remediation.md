# PR42 dependency security remediation decision

**Status:** implemented locally on 31 October 2026; merge and deployment remain
outside this change and require the final network-enabled Node 20 clean-install
and strict mobile audit evidence.

## Context

The final mobile production audit at commit `9803b6d` reported 22 package
records: 4 high, 17 moderate, 1 low, and 0 critical. The distinct new advisory
leaves were twelve node-forge sources plus Zod 1243066, minimatch 1244012, glob
1244013, and deepmerge 1243505. The strict verifier correctly rejected the
changed source/severity set. npm proposed Expo 58 and React Native 0.88 fixes,
which are major framework changes outside PR42's compatibility scope.

## Decision

Keep Expo 56.0.24 and React Native 0.85.3. Apply exact parent-scoped overrides
at the affected consumers, pin the resulting upstream tarball URL and integrity,
and prove compatibility through the APIs those consumers call.

| Finding leaf | Decision | Compatibility proof |
| --- | --- | --- |
| node-forge | `1.4.2` for Expo CLI and code signing | certificate/key round trip, signing, Node/browser DigestInfo regression, GCM/OID/JSBN malicious cases |
| Zod | `4.6.7` for Expo CLI | the two shipped CLI schemas parse valid data and reject invalid/extra data |
| glob | `14.0.2` at each Expo and `test-exclude` parent | CLI async wrappers plus shipped sync/array consumers, config bare detection, config-plugin iOS/Android extglob discovery, fingerprint nested `.gitignore` discovery, Metro package discovery, sync/async coverage globs |
| minimatch | `11.0.1` for fingerprint, `glob@14.0.2`, and `test-exclude` | exact nested `glob` edge, real fingerprint ignore matcher, and bounded malicious preprocessing |
| test-exclude | `8.0.0` under Babel Istanbul | include/exclude, sync/async glob, and Babel instrumentation |
| deepmerge | retain `4.3.1` with the reviewed PR 274 overlay | all four malicious payloads plus Expo-style nested config merging |

The artifact verifier owns the exact expected consumer versions and paths. A
future Expo patch changes that reviewed topology and must be explicitly
re-reviewed rather than being silently admitted. The npm audit verifier remains
source-strict: upstream fixes must remove their findings, while only the exact
source-verified braces and deepmerge advisories can be normalized.

Installed-tree traversal admits symlinks only at the canonical root link for a
package declared by the root workspace manifest. Both the upstream-artifact
and source-backport scanners traverse and real-path-deduplicate those workspace
targets; any other symlinked dependency ancestor fails admission.

## Rejected alternatives

- Do not use `npm audit fix --force`, Expo 58, or React Native 0.88 as a security
  shortcut; those require a separate framework migration and native parity
  qualification.
- Do not use broad root overrides. Every override belongs to an observed parent
  consumer and uses an exact version.
- Do not retain the node-forge 1.4.0 fork after 1.4.2 passes its old regression;
  the fork covered only one of the twelve reported sources.
- Do not downgrade deepmerge to 4.1.1. Direct malicious regression proved that
  it still exposes the null-placeholder prototype-confusion behavior.
- Do not add audit exceptions or lower severity thresholds. Unknown or changed
  findings still fail.

## Required release evidence

The commands in `/tmp/family-security-commands.md` are the operator handoff.
They require the repository's declared Node 20.19.4–20.x runtime and a
network-enabled npm registry. Completion requires:

1. a clean `npm ci` with both postinstall admissions passing;
2. source, artifact, consumer, Git-index, and audit-verifier regression suites;
3. mobile typecheck, tests, Expo dependency alignment, and Expo config loading;
4. frontend lint/test/build because the shared lock and Zod layout changed;
5. a fresh raw `npm audit --workspace mobile --omit=dev --json` and the strict
   wrapper accepting only the already-reviewed image-size exception plus the
   exact source-verified findings, if those version-based findings remain.

No production configuration, live dependency installation, merge, or deploy is
part of this remediation change.
