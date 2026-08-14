from __future__ import annotations

from email import policy
from email.parser import BytesParser
from subprocess import CalledProcessError

import pytest

from app.services.password_reset_mail import (
    LocalSendmailAdapter,
    MailSubmissionError,
    render_password_changed_message,
    render_reset_link_message,
)


def _message(raw: bytes):
    return BytesParser(policy=policy.default).parsebytes(raw)


def test_reset_template_uses_fixed_headers_fragment_link_and_escaped_html() -> None:
    reset_url = "https://family.multihost.ing/chore/reset-password#token=v1.safe-token&display=<unsafe>"
    raw = render_reset_link_message(
        recipient="parent@example.com",
        reset_url=reset_url,
        expires_minutes=15,
    )
    message = _message(raw)

    assert message["From"] == "Family Manager <no-reply@family.multihost.ing>"
    assert message["To"] == "parent@example.com"
    assert message["Subject"] == "Reset your Family Manager password"
    assert message["Auto-Submitted"] == "auto-generated"
    assert message["Message-ID"].endswith("@family.multihost.ing>")
    assert reset_url in message.get_body(preferencelist=("plain",)).get_content()
    html = message.get_body(preferencelist=("html",)).get_content()
    assert "#token=" in html
    assert "&amp;display=&lt;unsafe&gt;" in html
    assert "current password" not in html.casefold()
    assert "new password" not in html.casefold()


def test_password_changed_template_contains_no_reset_link_or_secret() -> None:
    raw = render_password_changed_message(recipient="parent@example.com")
    message = _message(raw)
    payload = raw.decode("utf-8")

    assert message["Subject"] == "Your Family Manager password changed"
    assert "reset-password" not in payload
    assert "#token=" not in payload
    assert "no-reply@family.multihost.ing" in payload


def test_local_sendmail_adapter_uses_fixed_argv_no_shell_and_safe_error_codes(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[object, dict[str, object]]] = []

    def fake_run(*args, **kwargs):
        calls.append((args, kwargs))
        return None

    monkeypatch.setattr("app.services.password_reset_mail.subprocess.run", fake_run)
    adapter = LocalSendmailAdapter(path="/usr/sbin/sendmail", timeout_seconds=5)
    adapter.submit(b"message")

    args, kwargs = calls[0]
    assert args[0] == ["/usr/sbin/sendmail", "-t", "-i"]
    assert kwargs["input"] == b"message"
    assert kwargs["timeout"] == 5
    assert kwargs["shell"] is False
    assert kwargs["check"] is True

    monkeypatch.setattr(
        "app.services.password_reset_mail.subprocess.run",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(CalledProcessError(1, ["/usr/sbin/sendmail"])),
    )
    with pytest.raises(MailSubmissionError, match="mta-rejected"):
        adapter.submit(b"secret-not-for-error-metadata")
