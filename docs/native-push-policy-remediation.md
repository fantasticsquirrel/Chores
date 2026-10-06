# Native push policy and runtime-clock remediation

## Findings and corrected invariants

Native enqueue previously checked active accounts and bound sessions but did
not independently enforce effective module access, notification/account
household scope, or push/approval preferences. A notification created while a
global, household, or user module grant was denied could acquire a durable
native outbox row; restoring that grant before the worker ran made the old row
sendable. Enqueue now rejects those denials, invalid endpoint tokens, and expired
notifications. Send/receipt-time authorization remains in place: grants and
preferences may change after a legitimate enqueue. Quiet hours still defer in
the worker rather than dropping notifications at enqueue.

The worker previously froze one timestamp for the entire batch. Earlier bounded
provider calls could cross later-row session/notification expiry or make a
later claim immediately older than the five-minute lease. Runtime processing
now samples the clock independently for each compare-and-swap claim and its
eligibility predicate, then checks time-sensitive policy with a fresh clock
after loading policy/session state. Retry and receipt due times are relative to
provider-call completion. Final writes compare the original claim timestamp,
not a subsequently refreshed timestamp, preserving stale-owner exclusion.
Explicit `now=` remains a frozen deterministic override, including lease,
policy, and backoff behavior relied upon by existing tests.

## Strict RED/GREEN evidence

Focused regressions live in
`backend/tests/test_native_push_policy_regressions.py`. They call the actual
production `create_notification` function (locally named `emit_notification` in
the test), commit denied creation, restore each grant before running the actual
worker, and require no native outbox row and no provider call. Direct enqueue
probes cover preferences, approval category, household consistency, session
actor scope, and expiry. Separate send-time grant probes preserve both gates.

Runtime-clock tests omit `now=` and replace only the clock and provider transport:

- A two-second first provider call crosses the later row's one-second auth or
  notification expiry; no expired second send is allowed.
- Sixty-three calls each advance five seconds before row 64 invokes a nested
  worker. Row 64 must have a fresh lease and be sent only once.
- Ticket acceptance, transient send failure, and pending receipt queries
  schedule due timestamps relative to the five-second provider completion.

On the unchanged production source the focused file produced **13 failures and
4 passes**, all failures at the intended policy/expiry/lease/due assertions.
The four passing controls verify existing session actor and send-time grant
protection. The existing native suite and focused regressions are run together
for GREEN; exact results and source hashes are persisted in the handoff JSON.

Reproduce with the project's configured Python environment:

```bash
PYTHONPATH=backend python -m pytest \
  backend/tests/test_native_push_delivery.py \
  backend/tests/test_native_push_policy_regressions.py -q
```

All probes use disposable SQLite, no provider network calls or credentials.
This does not change the documented bounded at-least-once contract: crash-after-
provider-acceptance may still cause a bounded resend. A revocation racing after
authorization cannot retract an external request already in flight. No live
provider/device, frontend build, or full backend-suite verification is claimed.
