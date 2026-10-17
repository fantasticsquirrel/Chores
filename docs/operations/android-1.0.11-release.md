# Android 1.0.11 / build 12 release candidate

This metadata update prepares a new APK from canonical Family Manager source.
The earlier 1.0.10 / build 11 APK predates the integrated Family Tree implementation.

## Scope

- Preserve Android package `com.fantasticsquirrel.familymanager`, existing EAS project/profile and remote signing identity.
- Increment the mobile display version to `1.0.11` and Android version code to `12`; keep mobile package and lockfile metadata coherent.
- Include the Family Tree implementation already integrated by PR #27, its production-schema compatibility fix from PR #28 and the current canonical source.
- Preserve disabled-by-default global and household Family Tree access. This release preparation does not activate the module, change household data, or approve its outstanding operational/device gates.
- Keep native push disabled until its separate provider/device prerequisites are satisfied.

## Publication boundaries

The metadata commit is not an APK build, artifact approval or publication record.
Require exact-head review and CI, canonical integration CI, a build bound to the resulting source commit, and verification of the downloaded APK's package/version, existing signer, runtime API, ZIP/ELF structure and provenance before publication.

A GitHub release must contain the verified APK and checksum with explicit build/source identity and measured limitations. Device testing must be stated accurately: host tests and static artifact validation are not an installed handset run. Do not describe an included but disabled Family Tree module as an activated production feature.

See [Android build workflow](../mobile-apk-build.md) and [Family Tree operator runbook](family-tree.md). Keep raw provider download URLs and credentials out of release notes and source control.
