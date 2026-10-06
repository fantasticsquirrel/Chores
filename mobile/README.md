# Family Manager Mobile

Expo TypeScript app for the Family Manager backend. The backend route prefix remains `/chore-api`.

## Setup

Install dependencies from the repository root:

```bash
npm install
```

## Run

From the repository root:

```bash
npm run mobile:start
npm run mobile:android
npm run mobile:ios
npm run mobile:typecheck
```

The direct workspace commands also work:

```bash
npm run start --workspace mobile
npm run android --workspace mobile
npm run ios --workspace mobile
npm run typecheck --workspace mobile
```

## Build an Android APK

Use the repeatable workflow documented in `../docs/mobile-apk-build.md`.

One-time setup from the repository root:

```bash
npm run mobile:eas:init
npm run mobile:eas:set-api -- https://family.multihost.ing/chore-api
```

Build an installable Android APK:

```bash
npm run mobile:apk
```

For a local build on a machine with Java and an Android SDK:

```bash
EXPO_PUBLIC_API_BASE_URL=https://family.multihost.ing/chore-api npm run mobile:apk:local
```

## API Base URL

The app reads `EXPO_PUBLIC_API_BASE_URL`. Keep the `/chore-api` suffix.

Android emulator default:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/chore-api npm run mobile:android
```

iOS simulator on the same Mac:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/chore-api npm run mobile:ios
```

Physical phone on the same network:

```bash
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8000/chore-api npm run mobile:start
```

Production:

```bash
EXPO_PUBLIC_API_BASE_URL=https://family.multihost.ing/chore-api npm run mobile:start
```

Real phones should use HTTPS/TLS in production. Plain HTTP may be blocked or limited by device and network security settings.

## Household feature parity

The app includes an actionable Home screen, notification inbox/personal reminder settings and a Recipes destination in More. Recipes supports detail/cooking, serving/multiplier scaling, manual/URL import, editing, variants, feedback, deletion and JSON backup/restore. Print/PDF uses Expo Print; native JSON export shares a file. Restore accepts pasted version-1 JSON.

Household write actions require an explicit server `can_manage` grant. Registration and parent recovery open the website. Native Expo push registration, opt-in controls, session-bound queue/delivery and receipt processing are implemented but default off. Real delivery requires provider credentials, an approved backend activation, a rebuilt app and eligible devices; an in-app inbox is not push delivery proof.

See [native push setup](../docs/native-push-setup.md) and [source-verified dependency backports](../docs/dependency-security-backports.md). Raw npm version advisories remain visible; do not skip install scripts or backport integrity checks.

See [the current parity audit](../docs/mobile-website-parity-audit-2026-10-04.md) for scope, adaptations, state invariants and release holds. Source/tests or an Expo Web preview are not proof that these features are installed in the distributed APK.

## iOS Limitations

Running the iOS simulator or creating iOS builds requires macOS with Xcode, or an EAS build workflow. The Expo project intentionally avoids native `ios/` and `android/` folders.
