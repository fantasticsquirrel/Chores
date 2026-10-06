# Native push durable delivery

Native Expo push is optional and disabled by default (`NATIVE_PUSH_ENABLED=false`).
An optional `NATIVE_PUSH_ACCESS_TOKEN` authenticates the provider request; do not
print it or device tokens. Registration/API and additive schema changes are
separate from this worker slice. Apply their migration before enabling delivery.

## Outbox and operation

Notification creation persists one `NotificationDeliveryAttempt` per enabled,
currently session-bound endpoint in the same transaction as the notification.
The unique `(notification_id, channel)` index and insert savepoint deduplicate
queue writes. Channels are `native:<subscription id>`; browser push retains
`push:<subscription id>` and its worker never claims native rows. Native enqueue
is independent of the browser VAPID configuration but obeys push preferences.
Creation performs no provider I/O.

Run the existing bounded worker entrypoint using the deployment's normal Python
environment and database configuration:

```bash
PYTHONPATH=backend python backend/scripts/process_push_deliveries.py
```

It prints separate `browser` and `native` status-count objects. Schedule repeated
invocations to process retries/receipts; this change does not install a scheduler.
Each native invocation selects at most 100 rows. Claims and final updates are
compare-and-swap, with a five-minute processing lease. Budgets are committed
before network calls, bounding crash retries to three sends and six receipt
queries. Concurrent workers cannot claim a live lease. A stale lease owner
cannot overwrite a later claim/result.

## Authorization and privacy

Immediately before provider I/O the worker rechecks endpoint enablement,
notification recipient ownership, household consistency, account activity,
original queued session binding, auth-session expiry/revocation/generation,
effective module access, push/approval preferences, notification expiry, and
household quiet hours. Old attempts cannot follow a rebound token to a new
actor or session. Quiet hours defer without consuming the provider budget.
Provider receipt lookups use the same checks. Authorization checks are not a
transaction across an external provider: a revocation racing after the check
cannot retract a request already in flight.

Payloads contain only the registered destination, generic `Family Manager`
title, generic `You have a new notification.` body, and
`data: {notification_id: <id>}`. No notification text, private URL, or household
content is sent. Workers must not log requests or credentials. Persisted queue
metadata consists only of session ID, bounded attempt counters, validated
non-secret receipt ID, and fixed reason codes; provider messages, exception
strings, tokens, and access credentials are never persisted there.

## State semantics and bounds

- `pending` → `processing` → `accepted`: a valid Expo ticket means provider
  acceptance only, **not delivered**. First receipt query is due after 15 minutes.
- `accepted` → `receipt_processing` → `provider_delivered`: receipt `ok` reports
  provider-side delivery, **not proof of device display or user receipt**.
- Transient send failures use `retry`; pending/transient receipt failures stay
  `accepted`, retaining the ticket and never resending the original notification.
  Backoff is two, eight, then thirty minutes, capped at thirty minutes.
- Exhausted budgets, malformed queue state, and permanent provider errors end
  `dead`; expired notifications end `expired`; denied policy ends `disabled`.
- `DeviceNotRegistered` disables the endpoint using its checked actor/session/
  token binding. `MessageTooBig`, `MismatchSenderId`, and `InvalidCredentials`
  are terminal without disabling unrelated subscriptions.

The provider destinations are fixed to
`https://exp.host/--/api/v2/push/send` and
`https://exp.host/--/api/v2/push/getReceipts`; no caller-supplied URL is accepted.
HTTP requests use five-second timeouts, no redirects, and streaming response
reads capped at 64 KiB. Failures are reduced to fixed internal reason codes.

This is a bounded **at-least-once** outbox, not exactly-once external delivery.
A crash after the provider accepts a send but before the ticket is committed
can cause a bounded resend; Expo does not provide a transactional send boundary.
Once a ticket is durably accepted, receipt work never resends. No live-provider
or physical-device verification is claimed by the offline tests.

## Focused verification

```bash
PYTHONPATH=backend python -m pytest backend/tests/test_native_push_delivery.py \
  backend/tests/test_notification_hardening.py backend/tests/test_notifications_api.py -q
```

Tests use disposable SQLite and explicitly injected offline send/receipt
providers. Coverage includes creation without VAPID, deduplication, browser
worker isolation, reentrant claim exclusion, expired-lease recovery, ticket vs
receipt semantics, policy/session checks, quiet hours, bounded retries,
rebound-actor rejection, terminal errors, response-size limits, safe diagnostics,
and the integrated entrypoint. Registration/API tests are owned separately.
