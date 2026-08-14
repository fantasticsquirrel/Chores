"""Repository contracts for the approval-gated password-reset mail deployment assets."""

from __future__ import annotations

import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
REQUIRED_PATHS = (
    "ops/mail/postfix/main.cf.family-manager.example",
    "ops/mail/postfix/master.cf.family-manager.example",
    "ops/mail/opendkim.conf.example",
    "ops/mail/opendkim/KeyTable.example",
    "ops/mail/opendkim/SigningTable.example",
    "ops/systemd/family-manager-password-reset-mail.service.example",
    "ops/systemd/family-manager-password-reset-mail.timer.example",
    "ops/nginx/family-manager-password-reset-rate-limit.conf.example",
    "docs/operations/password-reset-mail.md",
)


def _location_block(source: str, path: str) -> str:
    marker = f"location = {path} {{"
    assert marker in source, f"Missing exact Nginx location for {path}"
    return source.split(marker, 1)[1].split("\n}", 1)[0]


def test_password_reset_operations_examples_exist_and_preserve_the_hardened_contract() -> None:
    """Keep mail, timer, proxy, and runbook examples safe before host activation."""
    missing = [path for path in REQUIRED_PATHS if not (REPO_ROOT / path).is_file()]
    assert not missing, "Missing repository operation examples: " + ", ".join(missing)

    contents = {path: (REPO_ROOT / path).read_text() for path in REQUIRED_PATHS}
    postfix_main = contents["ops/mail/postfix/main.cf.family-manager.example"]
    postfix_master = contents["ops/mail/postfix/master.cf.family-manager.example"]
    opendkim = contents["ops/mail/opendkim.conf.example"]
    key_table = contents["ops/mail/opendkim/KeyTable.example"]
    signing_table = contents["ops/mail/opendkim/SigningTable.example"]
    service = contents["ops/systemd/family-manager-password-reset-mail.service.example"]
    timer = contents["ops/systemd/family-manager-password-reset-mail.timer.example"]
    nginx = contents["ops/nginx/family-manager-password-reset-rate-limit.conf.example"]
    runbook = contents["docs/operations/password-reset-mail.md"]

    # Outbound-only local MTA: no public listener, no open relay, only the two
    # local submitters, fixed sender, and DKIM for non-SMTP/sendmail injection.
    for expected in (
        "myhostname = mail.family.multihost.ing",
        "inet_interfaces = loopback-only",
        "authorized_submit_users = static:root, www-data",
        "smtpd_relay_restrictions = permit_mynetworks, reject_unauth_destination",
        "smtpd_recipient_restrictions = permit_mynetworks, reject_unauth_destination",
        "non_smtpd_milters = unix:/run/opendkim/opendkim.sock",
        "milter_default_action = tempfail",
        "no-reply@family.multihost.ing",
    ):
        assert expected in postfix_main

    active_master_lines = [
        line.split("#", 1)[0].strip()
        for line in postfix_master.splitlines()
        if line.split("#", 1)[0].strip()
    ]
    assert any(re.match(r"^pickup\s+unix\b", line) for line in active_master_lines)
    assert any(re.match(r"^smtp\s+unix\b", line) for line in active_master_lines)
    assert not any(
        re.match(r"^(smtp|submission|smtps)\s+inet\b", line)
        for line in active_master_lines
    ), "The outbound-only example must not enable an SMTP/submission inet listener."

    for expected in (
        "Mode s",
        "Domain family.multihost.ing",
        "Selector fm2026",
        "Socket local:/run/opendkim/opendkim.sock",
        "RequireSafeKeys true",
    ):
        assert expected in opendkim
    assert (
        "fm2026._domainkey.family.multihost.ing "
        "family.multihost.ing:fm2026:__REPLACE_WITH_MODE_0600_DKIM_PRIVATE_KEY_PATH__"
    ) in key_table
    assert (
        "no-reply@family.multihost.ing fm2026._domainkey.family.multihost.ing"
        in signing_table
    )

    # The worker remains bounded, least-privileged, and log-safe.
    for expected in (
        "Type=oneshot",
        "User=www-data",
        "Group=www-data",
        "--batch-size=25",
        "--log-counts-only",
        "NoNewPrivileges=true",
        "PrivateTmp=true",
        "PrivateDevices=true",
        "ProtectSystem=strict",
        "ProtectHome=true",
        "ProtectControlGroups=true",
        "ProtectKernelTunables=true",
        "ProtectKernelModules=true",
        "ProtectKernelLogs=true",
        "LockPersonality=true",
        "MemoryDenyWriteExecute=true",
        "RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6",
        "CapabilityBoundingSet=",
        "UMask=0077",
    ):
        assert expected in service
    for expected in (
        "OnCalendar=*-*-* *:*:00/30",
        "Persistent=true",
        "Unit=family-manager-password-reset-mail.service",
    ):
        assert expected in timer

    # Limit only the two public API routes after resolving client IP through an
    # explicitly trusted proxy, and own every response header on the SPA route.
    for expected in (
        "real_ip_header X-Forwarded-For;",
        "set_real_ip_from __REPLACE_WITH_TRUSTED_PROXY_CIDR__;",
        "real_ip_recursive on;",
        "limit_req_zone $binary_remote_addr zone=family_manager_password_reset_request:10m rate=",
        "limit_req_zone $binary_remote_addr zone=family_manager_password_reset_confirm:10m rate=",
    ):
        assert expected in nginx
    request_block = _location_block(nginx, "/chore-api/auth/password-reset/request")
    confirm_block = _location_block(nginx, "/chore-api/auth/password-reset/confirm")
    for block, zone in (
        (request_block, "family_manager_password_reset_request"),
        (confirm_block, "family_manager_password_reset_confirm"),
    ):
        assert "client_max_body_size 2k;" in block
        assert f"limit_req zone={zone}" in block
        assert "proxy_set_header X-Real-IP $realip_remote_addr;" in block
        assert "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;" in block
        assert "proxy_set_header X-Forwarded-Proto $scheme;" in block
    assert "location /chore-api/auth/password-reset" not in nginx
    for expected in (
        'return 202 \'{"detail":"Try signing in. If you cannot sign in, request a new reset link."}\';',
        "error_page 429 = @family_manager_password_reset_confirm_limited;",
    ):
        assert expected in nginx
    for named_location in (
        "@family_manager_password_reset_request_limited",
        "@family_manager_password_reset_confirm_limited",
    ):
        named_block = nginx.split(f"location {named_location} {{", 1)[1].split("\n}", 1)[0]
        assert 'add_header Cache-Control "no-store" always;' in named_block
        assert 'add_header Referrer-Policy "no-referrer" always;' in named_block
        assert 'add_header X-Content-Type-Options "nosniff" always;' in named_block

    reset_page_block = _location_block(nginx, "/chore/reset-password")
    for expected in (
        'add_header Cache-Control "no-store" always;',
        'add_header Referrer-Policy "no-referrer" always;',
        'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;',
        'add_header Content-Security-Policy "default-src \'self\'; base-uri \'none\'; form-action \'self\'; frame-ancestors \'none\'; object-src \'none\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data:; connect-src \'self\';" always;',
        'add_header X-Frame-Options "DENY" always;',
        'add_header X-Content-Type-Options "nosniff" always;',
    ):
        assert expected in reset_page_block

    runbook_lower = runbook.lower()
    for expected in (
        "dns",
        "ptr",
        "spf",
        "dkim",
        "dmarc",
        "outbound tcp 25",
        "ssrf",
        "deployment preflight",
        "rollback",
        "incident",
        "controlled external mailbox",
        "no automatic production activation",
        "add_header",
        "approval-gated",
        "no public smtp submission",
    ):
        assert expected in runbook_lower
    assert (
        "/usr/bin/setpriv --no-new-privs /usr/sbin/sendmail -bv "
        "no-reply@family.multihost.ing"
    ) in runbook
    assert "NoNewPrivileges=true" in runbook

    # Repository examples are templates, never a source for key material or a
    # deployment's application-database location.
    all_contents = "\n".join(contents.values())
    assert "__REPLACE_WITH_" in all_contents
    assert "-----BEGIN" not in all_contents
    assert "sqlite:" not in all_contents.lower()
    assert "database_url=" not in all_contents.lower()
