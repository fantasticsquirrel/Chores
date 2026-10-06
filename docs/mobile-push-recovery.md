# Mobile device notification recovery

The authenticated app shell owns device push status and listeners across inbox
tab changes. Device and browser push controls remain separate. Unsupported web
previews and Expo Go do not load remote-push SDKs. Foreground presentation does
not expose household inbox content in OS banners or sounds.

If checking server configuration or loading the native runtime temporarily
fails, Device notifications shows a safe generic message and **Retry device
notifications**. The same secondary action can recheck an unavailable build or
server. Retry reads configuration, session-scoped registrations, authoritative
notification preferences and current OS permission; it never requests permission,
obtains a token, registers a device, or changes reminder preferences. Enable
remains an explicit user action.

A registration and OS permission alone do not mean delivery is enabled. At least
one accessible module must have an authoritative configured `push_enabled: true`
policy. Opt-in to one module (for example chores only) is sufficient; every module
need not be enabled. If all accessible policies are off, the device is reported
as registered with preferences off, and explicit Enable remains available. If
preferences cannot be read, status is error, not enabled. A partially successful
Enable followed by repeated Retry therefore cannot manufacture delivery consent;
explicit Enable can repair failed preference activation and verifies readback.
Zero accessible configured notification channels never counts as enabled.

Server registration ownership is independent of OS permission and display status.
When permission is blocked, the message states that the device remains registered.
Disable remains operable with a verified enabled session registration, including
off/error states, and confirms absence after session-scoped deletion. It never
changes global/browser preferences or registrations owned by another session.
Token rotation follows verified registration consent, not an unverified delivery
status; it reads permission without prompting and does not activate preferences.

Save reminder settings owns the screen's primary action. Device Enable, Disable
and Retry are secondary, including off, error, enabled and busy states.

Status checking, enable and disable share one controller busy lock. Repeated
retry taps are bounded to one in-flight check. Refresh removes previous
listeners before replacing them; authentication replacement or shell unmount
invalidates pending completion and navigation. Retry is disabled while busy.

Regression coverage includes temporary configuration/runtime failure, listener
cleanup, concurrent taps, authentication replacement, permission-prompt and
registration non-effects, the shell hook binding, and accessible disabled retry.
Run the notification controller unit tests, native runtime/hook/inbox render
tests and `npm run mobile:typecheck` after changes.

These are source-level tests. Native notification SDK packages/provider
configuration, a configured physical-device build and real delivery validation
are separate gates; successful source tests do not establish native delivery.
