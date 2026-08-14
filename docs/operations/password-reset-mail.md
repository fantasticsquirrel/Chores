# Password-reset local mail operations

> **Status:** repository design and approval-gated templates only. This document
> does **not** authorize package installation, DNS changes, firewall changes,
> `/etc` writes, migration, service restart, or production activation.

Family Manager password recovery uses an opaque fragment capability, a
secret-free delivery outbox, a local `sendmail` handoff, and an outbound-only
Postfix/OpenDKIM MTA. There is no automatic production activation.

## Security boundary

- The application database contains a reset-row identifier, versioned HMAC
  digest, expiry, and delivery status. It never stores raw reset tokens,
  reset URLs, passwords, email bodies, SMTP credentials, or DKIM keys.
- The worker derives a reset token only in memory after leasing and rechecking a
  row, then submits it with fixed argv: `sendmail -t -i` and no shell.
- The sender is fixed to `Family Manager <no-reply@family.multihost.ing>`.
  Link tracking, analytics pixels, URL rewriting, and external email relays are
  out of scope for v1.
- The MTA is outbound-only. It has **no public SMTP submission**, inbound SMTP,
  smtps, submission, mailbox, or MX role.
- The reset page is token-free at HTTP level; the browser fragment is removed
  before form display. Nginx and the application both set `Cache-Control:
  no-store`, `Referrer-Policy: no-referrer`, CSP, frame denial, and `nosniff`.

## Deployment preflight — explicit approval required

Obtain one written approval covering the whole deployment bundle before doing
any host mutation:

1. install or configure Postfix/OpenDKIM and their packages;
2. create the root-owned mode-0600 environment/key files;
3. change DNS, PTR/rDNS, SPF, DKIM, DMARC, firewall, or provider settings;
4. copy templates into `/etc`, enable/reload systemd/Nginx, migrate the real
   application database, and run a controlled external mailbox test.

Before approval, inspect only the active systemd unit, actual app upstream,
active Nginx include tree, database backup process, provider outbound TCP 25
policy, and DNS ownership. Never guess the production upstream or database URL.

## DNS and delivery readiness

The dedicated sender must have all of the following before enabling
`PASSWORD_RESET_ENABLED=true`:

- A forward A/AAAA record for `mail.family.multihost.ing` and matching provider
  managed PTR/rDNS for its public address.
- SPF authorizing that address to send for `family.multihost.ing`.
- A 2048-bit DKIM public record for `fm2026._domainkey.family.multihost.ing`.
  Generate and retain the private key only in an approved root-owned path;
  never place it in this repository, chat, logs, screenshots, or a database.
- DMARC initially in monitoring mode (`p=none`) with a mailbox the owner
  controls. Move to enforcement only after controlled external mailbox header
  evidence is reviewed.
- No MX record that points to this outbound-only host. Bounce/DMARC-report
  receipt is a separate reviewed inbound-mail project.
- Confirm provider policy and actual outbound TCP 25 viability. Do not silently
  substitute a SaaS SMTP relay if egress or reputation fails; escalate that
  product/operations decision.

Use an approved firewall policy to prevent Postfix SMTP egress from reaching
loopback, RFC1918, CGNAT, link-local, multicast, documentation, and other
reserved address ranges. This prevents DNS/MX-controlled delivery from becoming
an SSRF-like private-network egress path. Allow only public destination ranges
needed for direct-to-MX delivery.

## Template installation plan

After approval and an offline review of substitutions:

1. Start from `ops/mail/postfix/*.family-manager.example`,
   `ops/mail/opendkim*.example`, and `ops/systemd/*.example`; replace every
   `__REPLACE_WITH_...__` value in a secure staging directory, not in Git.
2. Put application settings in `/etc/family-manager/password-reset-mail.env`
   owned by root and mode `0600`. It must contain the existing application
   configuration plus reset-key ring/rate-limit secrets; do not echo it.
3. Store the DKIM private key outside the repository, restrict it to the
   OpenDKIM service account, and use the `KeyTable` placeholder only after its
   ownership/mode have been verified.
4. Install the Postfix master configuration with no active `smtp`,
   `submission`, or `smtps` `inet` service. The only handoff is local
   `sendmail`/pickup from root and `www-data`.
5. Run configuration checks before daemon reload: Postfix syntax, OpenDKIM key
   readability, and `nginx -t`. Do not reload an untested active Nginx config.
6. Apply the Nginx fragment only at the confirmed HTTPS server and trusted proxy
   boundary. Set the concrete trusted proxy CIDR; never trust arbitrary
   `X-Forwarded-For` from direct clients. Confirm its `add_header` directives
   remain present because child location blocks replace inherited headers.
7. Enable the timer, not a long-lived unbounded worker. It invokes
   `scripts.process_password_reset_mail --batch-size=25 --cleanup
   --log-counts-only` under `www-data` with a hardened one-shot systemd unit.
   Confirm the installed unit retains `NoNewPrivileges=true`, `ProtectSystem=strict`,
   `ProtectHome=true`, `PrivateTmp=true`, and the narrow `ReadWritePaths`; do not
   weaken those protections merely to make Postfix or application paths work.

A local identity lookup can be checked without exposing a message body or
recipient list:

```sh
/usr/bin/setpriv --no-new-privs /usr/sbin/sendmail -bv no-reply@family.multihost.ing
```

This does not prove external delivery. It only verifies the local MTA accepts
that sender identity under the reviewed service boundary.

## Controlled external mailbox verification

Only after approval and with a dedicated owner-controlled external mailbox:

1. Request a reset for a test parent account and inspect worker logs for
   aggregate counts only. Do not copy the reset URL/token into tickets, shells,
   screenshots, browser histories, or chat.
2. Inspect the received **raw headers** in the external mailbox for the expected
   sender domain, SPF result, DKIM signature/domain/selector, and DMARC
   alignment. Verify no tracking redirect or third-party asset appears.
3. Complete one browser journey: request, fragment removal, reset-page headers,
   generic completion acknowledgement, old-password rejection, fresh login, and
   a replay that is non-mutating and returns the same generic acknowledgement.
4. Check that no public listener exists for TCP 25/465/587 and that no public
   SMTP submission route was introduced.
5. Record only non-secret evidence: test timestamp, service/timer state,
   aggregate worker counts, MTA queue depth, and header authentication results.

## Monitoring and retention

- Alert on dead reset deliveries, sustained `mta-timeout`/`mta-unavailable`,
  timer failures, queue growth, unsigned/rejected message evidence, and DNS
  authentication regressions.
- Systemd output must remain aggregate counts only. Do not log message bytes,
  recipients, reset URLs, raw tokens, passwords, cookies, headers with secrets,
  or database connection strings.
- Review Postfix queues and OpenDKIM health using privileged operations; do not
  dump queue message content into incident tickets.
- Delivery rows and redacted reset-request history are pruned with their parent
  expired reset rows after the configured application retention period. Local
  MTA acceptance means only that Postfix accepted the message; Postfix is
  responsible for post-acceptance Internet retry and this application never
  represents it as recipient delivery.

## Rollback and incident response

### Normal rollback

1. Set `PASSWORD_RESET_ENABLED=false` in the secure environment file.
2. Stop/disable the password-reset timer and restart only the application after
   its normal configuration validation.
3. Leave the additive database migration in place; do **not** blindly roll it
   back or delete mail queues.
4. Verify request endpoints return their generic acknowledgement without issuing
   mail and preserve existing non-reset application functionality.

### Suspected capability or sender-key exposure

1. Disable issuance and the worker immediately through the approved operational
   path.
2. Invalidate active reset rows and cancel pending reset-link deliveries using a
   reviewed administrative transaction; preserve redacted audit records.
3. Rotate the reset-token key ring and rate-limit pepper. Rotate/revoke the DKIM
   key if it may be exposed, then update DNS and validate fresh headers.
4. Investigate access logs, Nginx configuration, MTA queues, service journals,
   and secret-file permissions without copying secrets into the incident record.
5. Re-enable only after a new deployment preflight, controlled external mailbox
   result, and explicit approval.

This runbook intentionally has no command that automatically activates a
production MTA. Every host change remains approval-gated.
