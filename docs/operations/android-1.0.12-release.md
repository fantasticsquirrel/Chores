# Android 1.0.12 / code 13 correction candidate

This source candidate supersedes 1.0.11 / code 12; it is **not an approved APK**.
The previous candidate's unchanged verifier rejected the 64-bit DataStore shared
counter libraries. Do not publish that failed artifact as the correction.

The managed Expo plugin adds a regular app dependency on
`androidx.datastore:datastore-core:1.2.1` through `withAppBuildGradle`.
Google's module metadata selects the Android variant and aligns the atomic
DataStore group; no Android-only force, SDK upgrade or validator exception is used.
The plugin rejects unsupported Gradle languages, malformed/ambiguous target
blocks and conflicting DataStore declarations rather than silently rewriting them.

Focused tests and disposable Android prebuild verified insertion, preservation,
idempotence, package identity and successor metadata. Actual Gradle
`releaseRuntimeClasspath` resolution selected all participating DataStore modules
at 1.2.1, including `datastore-core-android`. Its resolved AAR SHA-256 is
`435edad7bcb1fbb1a2a46de7be4d6daf299479b3328ebf757ebdfe02810cbdd8`,
matching the separately audited official four-ABI vendor AAR.
The graph traces the old 1.1.7 request through Firebase common/notifications;
installed AsyncStorage 2.2.0 itself declares no DataStore dependency.

Before distribution: independent source review, final CI, a new signed APK bound
to this source/version, and the unchanged whole-APK verifier remain required.
Device upgrade and DataStore runtime behavior are unverified: no device is available.
Package, profile, API, signing, Firebase dynamic configuration and activation
behavior are unchanged. No build or publication is represented by this note.
