# Android APK Build Workflow

This repo ships the mobile app as an Expo project in `mobile/`. The repeatable
Android APK path uses EAS Build with the `apk` profile in `mobile/eas.json`.

The APK embeds `EXPO_PUBLIC_API_BASE_URL` at build time. Use an HTTPS backend
URL ending in `/chore-api`.

## One-time setup

1. Sign in to Expo:

   ```bash
   cd mobile
   npx --yes eas-cli@20.0.0 login
   ```

2. Link or create the EAS project:

   ```bash
   npm run mobile:eas:init
   ```

3. Set the preview API URL used by the APK profile:

   ```bash
   npm run mobile:eas:set-api -- https://family.multihost.ing/chore-api
   ```

## Build an installable APK

From the repository root:

```bash
npm run mobile:apk
```

The command typechecks the mobile app, verifies the EAS preview environment has
`EXPO_PUBLIC_API_BASE_URL`, then starts an Android cloud build with:

```bash
eas build --platform android --profile apk --non-interactive --wait
```

When EAS finishes, it prints a download URL for the `.apk`.

To update the API URL and build in one command:

```bash
EXPO_PUBLIC_API_BASE_URL=https://family.multihost.ing/chore-api npm run mobile:apk
```

Before cutting a new Android APK, bump both:

- `mobile/app.json` `expo.version`
- `mobile/app.json` `expo.android.versionCode`

Android uses `versionCode` for APK upgrade/install decisions. Reusing an old
version code can produce a generic "something went wrong" install failure on a
phone.

If Android still refuses the APK, remove any old build with the same package
name before installing the new one:

```bash
adb uninstall com.fantasticsquirrel.familymanager
adb install -r path/to/family-manager.apk
```

If that still fails, capture the exact package-manager reason with:

```bash
adb install -r path/to/family-manager.apk
```

Common failures are `INSTALL_FAILED_UPDATE_INCOMPATIBLE` for a signing-key
conflict, `INSTALL_FAILED_VERSION_DOWNGRADE` for version code problems, and
`INSTALL_FAILED_OLDER_SDK` if the phone is below Android 7.0.

## Local APK build

Local EAS builds are useful on a machine with Java and an Android SDK installed:

```bash
EXPO_PUBLIC_API_BASE_URL=https://family.multihost.ing/chore-api npm run mobile:apk:local
```

The local output path is:

```text
builds/family-manager.apk
```

Do not commit APKs or local build outputs; `builds/` is intentionally ignored.

## Related commands

```bash
npm run mobile:eas:whoami
npm run mobile:typecheck
npm run mobile:start
npm run mobile:android
```

## Notes

- `mobile/eas.json` profile `apk` sets Android `buildType` to `apk`, not the
  default Play Store `.aab`.
- The production profile remains configured for Android app bundles.
- iOS builds still require macOS/Xcode locally or an EAS iOS workflow with Apple
  credentials.
