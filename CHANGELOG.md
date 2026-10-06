# Changelog

## 1.0.9 — household mobile parity

- Android build 10, with the production API explicitly bound in the APK build profile.
- Native push remains disabled until private provider configuration and installed-device verification are complete.

- Native household cookbook, recipe editing/scaling/variants, portable backup,
  and print/file output workflows with authoritative module permissions.
- Personal inbox/reminder controls, actionable parent Home, registration links,
  and matching-generation password/session teardown.
- Dark form contrast, web checkbox semantics, fractional quantity editing, and
  web More-menu focus corrections.
- Session-bound opt-in native Expo push subscriptions, durable send/receipt
  worker, generic notification payloads and authenticated shell lifecycle.
  Requires provider credentials, approved server activation, a new app build,
  and real device verification; not automatically enabled or published.
- Integrity-pinned local security backports for the unreleased braces and
  node-forge fixes. Version-based npm advisories remain visible; protection
  requires install-time source validation and exploit regressions.
- Native Firebase client configuration stays outside Git; build configuration
  rejects invalid or wrong-package inputs. APK installation guidance no longer
  instructs an automatic destructive uninstall.
