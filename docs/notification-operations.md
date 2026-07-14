# Notification scheduler and push worker

Family Manager stores notification rows and push delivery attempts in SQLite. API requests only enqueue attempts; they never perform outbound network I/O.

## Install

```bash
sudo install -m 0644 ops/systemd/chore-tracker-notification-scheduler.{service,timer} /etc/systemd/system/
sudo install -m 0644 ops/systemd/chore-tracker-push-worker.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now chore-tracker-notification-scheduler.timer chore-tracker-push-worker.timer
```

The environment file must contain valid VAPID keys before push delivery is enabled. Keep push disabled while keys are absent.

## Security model

- Subscription endpoints must be HTTPS, resolve exclusively to global addresses, and belong to a supported browser push service.
- The worker revalidates the endpoint immediately before each request, refuses redirects, caps payloads, and uses a five-second timeout.
- HTTP 404/410 and unsafe endpoint changes disable the subscription.
- Transient failures receive two delayed retries, then become `dead`.
- Quiet hours are evaluated in the household timezone and defer queued delivery.
- Notification `dedup_key` values and queue-channel checks prevent duplicate generation/delivery.

## Verification

```bash
systemd-analyze verify ops/systemd/chore-tracker-*.service ops/systemd/chore-tracker-*.timer
sudo systemctl start chore-tracker-notification-scheduler.service
sudo systemctl start chore-tracker-push-worker.service
sudo journalctl -u chore-tracker-notification-scheduler.service -u chore-tracker-push-worker.service --since today
```

The scripts emit JSON count summaries. An empty object is a successful no-op.
