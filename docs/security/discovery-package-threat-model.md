# Discovery package adversarial review

## Boundaries and adversaries

A package author controls ZIP names, metadata, assets, and all worker JavaScript.
A child may forge browser messages and call backend endpoints directly. A parent
in another household may know package IDs and version strings. A formerly
permitted child may retain downloaded bytes after access or publication changes.
None may obtain application cookies, parent DOM access, other household content,
or implicit approval of a newly published version.

The backend must independently enforce session, module view/manage, household,
child identity, explicit version grants, and CSRF. Every executable payload read
must be online-authorized and no-store. Client cache identity must include
household/user/version/checksum and must never authorize access itself.

The runtime must expose neither HTML nor arbitrary DOM properties. Renderer
validation must reconstruct an allowlisted object, limit arrays/text/ranges and
numeric finiteness, reject URLs, and never spread attacker-controlled properties.
Messages require the exact iframe window plus a random capability; opaque origin
alone is not sender authentication. Validation occurs before costly rendering.

## Attack matrix

- ZIP: traversal, duplicate/alias names, backslashes, drive paths, symlinks,
  unsupported compression/encryption, declared-vs-actual sizes, bombs, CRC errors,
  undeclared files, invalid JSON/UTF-8, duplicate JSON keys and manifest schemas.
- Assets: MIME mismatch, checksum mismatch, HTML/SVG/script masquerading as images,
  malicious source URLs, unsupported files and JavaScript import mechanisms.
- Access: unauthenticated, child, parent without manage, disabled module, foreign
  household/child, missing CSRF, publish/rollback grant invalidation and revocation.
- Browser: fetch/XHR/WebSocket/importScripts/dynamic imports/nested workers,
  storage/cookie/DOM access, frame or top navigation, forged capability/source,
  oversized/message-flood payloads and sustained CPU use.
- Lifecycle: stale late fetches, identity switches, route unmount, focus refresh,
  network failure, grant revocation, publication changes and worker disposal.

## Limits that must remain explicit

A worker is not a hard memory quota. Browser-native structured cloning occurs
before JavaScript can validate a received message. Malicious code may exhaust
memory or CPU before watchdog termination; a JS heartbeat is not resource
isolation. Network/DOM isolation claims require real browser evidence, not CSP
string assertions. No test of one browser version establishes universal browser
behavior. Offline access cannot be revoked after bytes have been delivered;
application revocation means refusing subsequent payload reads and stopping the
in-app session on the next successful authorization check or failure.

This document is the test plan, not a claim that all checks passed. Actual evidence
and remaining failures are reported separately.

## Executed evidence (2026-10-24)

- Independent backend suite: `PYTHONPATH=backend .venv/bin/pytest -q
  backend/tests/test_discovery_package_adversarial.py`: 10 passed after fixes.
  This includes a formerly accepted inverse domain producing Infinity, now
  rejected; stale version approval now returns 409 and leaves child access denied.
- Independent renderer suite: `npx vitest run
  frontend/src/features/discovery-lab/packages/bridge.adversarial.test.ts
  --environment node`: 3 passed, covering URL paint, malformed geometry/types,
  size/count bounds, cycles and duplicate controls.
- Real browser: `CHROMIUM_EXECUTABLE_PATH=/tmp/chromium node
  scripts/security/discovery-package-browser-audit.cjs`: passed in Chromium
  153.0.8010.0 with Chromium sandbox enabled. Actual generated iframe bootstrap
  creates the actual blob worker; worker securitypolicyviolation events show
  connect-src blocking a recovered prototype fetch and script-src blocking
  prototype importScripts, external/blob dynamic import and eval. Native DOM,
  cookie, parent, worker-constructor, WebSocket, BroadcastChannel and beacon
  globals are unavailable. Wrong capability cannot start execution. Infinite
  response loops, oversized output and cyclic output terminate with an error.

Initial system Chromium launch failed before browser startup due container IPC
constraints. The supported packaged headless Chromium binary ran successfully
without disabling its sandbox or web security. These are browser-engine-specific
findings, not proof for Firefox, Safari, Android WebView, or native execution.

Remaining limits: no hard memory quota, no exhaustive browser vulnerability
analysis, and no guarantee against renderer-process resource exhaustion during
structured clone. A timed-out worker response is stopped, but hostile memory
allocation can occur before the timeout. Network authorization cannot revoke
already delivered bytes outside the application. The in-app runtime must stop
on authorization failure/deadline and remove its iframe when unmounted.

Cache review identified a persisted JSON payload trusting its own checksum claim.
It has been replaced with bounded session-memory content, partitioned by explicit
identity and cleared on identity changes and runtime unmount. Independent
`packageCache.adversarial.test.ts` verifies localStorage tampering is ignored,
network payload retrieval occurs, and identity switch/clear forces a refetch.
Together with the drawing audit, 5 independent frontend test cases pass. A raw
ZIP hash is not a cryptographic digest of the normalized JSON payload; do not
reintroduce persistent payload trust without a separately authenticated digest.

The response watchdog is an availability mitigation, not a sandbox escape proof.
It is active while an input awaits a response. A malicious worker can emit a
valid response and then consume CPU until the next input; when the host is
paused, there is no perpetual watchdog. This remains a local denial-of-service
risk, not access to the host DOM or network. A production threat model requiring
hard CPU/memory quotas needs an execution service with enforceable resource
limits rather than browser Workers alone.
