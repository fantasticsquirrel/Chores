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
npm run mobile:eas:set-api -- https://YOUR_DOMAIN/chore-api
```

Build an installable Android APK:

```bash
npm run mobile:apk
```

For a local build on a machine with Java and an Android SDK:

```bash
EXPO_PUBLIC_API_BASE_URL=https://YOUR_DOMAIN/chore-api npm run mobile:apk:local
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
EXPO_PUBLIC_API_BASE_URL=https://YOUR_DOMAIN/chore-api npm run mobile:start
```

Real phones should use HTTPS/TLS in production. Plain HTTP may be blocked or limited by device and network security settings.

## iOS Limitations

Running the iOS simulator or creating iOS builds requires macOS with Xcode, or an EAS build workflow. The Expo project intentionally avoids native `ios/` and `android/` folders.
