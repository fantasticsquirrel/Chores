# Native push setup and verification

This is an opt-in Expo push path, separate from browser Web Push and email.
It is implemented in source, but defaults **off**; no existing installation or
production setting is changed by checking out this branch.

## Provider prerequisites

- Keep the real Firebase Android client `google-services.json` outside Git.
  Its Android package must match `com.fantasticsquirrel.familymanager`.
- Set `GOOGLE_SERVICES_JSON` to that secure local path before Android prebuild
  or local build. `mobile/app.config.js` rejects missing/invalid/wrong-package
  files without printing their contents. This client configuration is **not**
  the private FCM v1 service-account credential.
- Configure the app project's FCM v1 service-account credential in EAS for
  Android, and an APNs key plus appropriate entitlement/profile for iOS.
  Supply credentials through the provider's secure credential tooling, never
  in chat, source files, logs, or screenshots.
- If enhanced Expo push security is enabled, configure the matching
  `NATIVE_PUSH_ACCESS_TOKEN` privately on the backend.
- Backend `NATIVE_PUSH_ENABLED` is false by default. Enable it only in an
  explicitly approved environment after provider/build/device checks.
- Retain the existing scheduled `backend/scripts/process_push_deliveries.py`
  invocation: it processes both the browser and native outboxes. It must run
  repeatedly for native ticket receipt processing, not just once.

## User/device flow

1. Sign in to an installed, project-configured native app.
2. Open Notifications and explicitly enable device notifications.
3. On Android the `household` notification channel is created before OS
   permission/token requests and native messages explicitly target that channel.
   No permission prompt is issued merely by navigating the app.
4. Registration receipt, current-session inventory, and push preferences are
   read back before reporting enabled. Permission denial, simulator/Expo Go,
   missing project, disabled backend, and unavailable runtime are not success.
5. Disabling revokes the current-session native registrations, verifies their
   absence, and leaves browser/other-session push preferences alone.
6. Logout, password changes, expiry, grants and membership changes invalidate
   queued sends through server-owned session/policy checks. A send already
   accepted by the provider cannot be recalled; only generic household text
   and a notification ID are sent, never private titles or content.
7. Native listeners live with the authenticated shell, not just the inbox.
   Notification URLs are never executed; routing requires authenticated inbox
   ownership and the existing role/module destination allowlist. Unavailable
   or older-than-inventory notification IDs fail closed.

## Evidence boundaries

Tests with injected senders/receipt readers are explicitly offline fixtures.
Ticket `accepted` is not `provider_delivered`, and an OK provider receipt still
is not observed device receipt. A debug APK, prebuild, JS export, or browser
screenshot is not signed release, installed-device, TalkBack, APNs/FCM, or store
proof. Preserve separate Android/iOS device receipts and lifecycle checks before
release approval. Do not uninstall a real app just to produce a clean test; use
an isolated test identity/build or explicitly approved destructive reset.

See [subscription safety](native-push-subscriptions.md),
[worker and receipt states](native-push-delivery.md), and
[dependency backport integrity](dependency-security-backports.md).
