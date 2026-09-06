from __future__ import annotations

from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from email.utils import make_msgid
from html import escape
from urllib.parse import quote

from sqlalchemy import and_, delete, or_, select, update

from app.config import Settings, get_settings
from app.db import get_session_factory
from app.models import AccountRegistration, AccountRegistrationDelivery
from app.security.registrations import format_registration_token
from app.services.password_reset_mail import LocalSendmailAdapter, MailSubmissionError


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


class RegistrationMailWorker:
    def __init__(self, *, settings: Settings | None = None, submit=None) -> None:
        self.settings = settings or get_settings()
        self.submit = submit or LocalSendmailAdapter(path=self.settings.password_reset_sendmail_path, timeout_seconds=self.settings.password_reset_sendmail_timeout_seconds).submit

    def process_pending(self, *, limit: int | None = None) -> dict[str, int]:
        if not self.settings.registration_enabled:
            return {}
        now = datetime.now(UTC)
        factory = get_session_factory(self.settings.database_url)
        claimable = or_(
            and_(AccountRegistrationDelivery.status.in_(("pending", "retry")), AccountRegistrationDelivery.available_at <= now),
            and_(AccountRegistrationDelivery.status == "processing", AccountRegistrationDelivery.lease_expires_at <= now),
        )
        with factory() as session:
            ids = list(session.scalars(select(AccountRegistrationDelivery.id).where(claimable).order_by(AccountRegistrationDelivery.id).limit(limit or self.settings.password_reset_worker_batch_size)).all())
        counts: dict[str, int] = {}
        for delivery_id in ids:
            with factory() as session:
                claimed = session.execute(update(AccountRegistrationDelivery).where(AccountRegistrationDelivery.id == delivery_id, claimable).values(status="processing", lease_expires_at=now + timedelta(seconds=self.settings.password_reset_delivery_lease_seconds)))
                session.commit()
                if claimed.rowcount != 1:
                    continue
            with factory() as session:
                delivery = session.get(AccountRegistrationDelivery, delivery_id)
                registration = session.get(AccountRegistration, delivery.registration_id) if delivery else None
                if registration is None or registration.consumed_at is not None or registration.invalidated_at is not None or _utc(registration.expires_at) <= now:
                    if delivery:
                        delivery.status = "cancelled"; delivery.terminal_at = now; delivery.lease_expires_at = None
                        session.commit()
                    counts["registration_cancelled"] = counts.get("registration_cancelled", 0) + 1
                    continue
                token = format_registration_token(registration.id, key_version=registration.token_key_version, token_keys=self.settings.password_reset_token_keys)
                url = f"{self.settings.password_reset_public_app_url.rstrip('/')}/verify-email#token={quote(token, safe='._-')}"
                message = EmailMessage()
                message["From"] = "Family Manager <no-reply@family.multihost.ing>"
                message["To"] = registration.email
                message["Subject"] = "Verify your Family Manager account"
                message["Auto-Submitted"] = "auto-generated"
                message["Message-ID"] = make_msgid(domain="family.multihost.ing")
                minutes = max(1, int((_utc(registration.expires_at) - now).total_seconds() // 60))
                message.set_content(f"Verify your Family Manager account within {minutes} minutes:\n\n{url}\n\nIf you did not request this, ignore this email.")
                message.add_alternative(f'<p>Verify your Family Manager account.</p><p><a href="{escape(url, quote=True)}">Verify email and create household</a></p><p>This link expires in {minutes} minutes.</p>', subtype="html")
                try:
                    self.submit(message.as_bytes())
                except MailSubmissionError as exc:
                    delivery.attempt_count += 1
                    delivery.last_error_code = exc.args[0] if exc.args else "mta-failed"
                    delivery.status = "dead" if delivery.attempt_count >= self.settings.password_reset_delivery_max_attempts else "retry"
                    delivery.lease_expires_at = None
                    delivery.available_at = now + timedelta(seconds=30 * (2 ** max(0, delivery.attempt_count - 1)))
                    if delivery.status == "dead": delivery.terminal_at = now
                    session.commit()
                    counts[f"registration_{delivery.status}"] = counts.get(f"registration_{delivery.status}", 0) + 1
                    continue
                delivery.status = "accepted"; delivery.attempt_count += 1; delivery.lease_expires_at = None; delivery.accepted_by_mta_at = now; delivery.terminal_at = now
                session.commit()
                counts["registration_accepted"] = counts.get("registration_accepted", 0) + 1
        return counts

    def cleanup(self) -> dict[str, int]:
        cutoff = datetime.now(UTC) - timedelta(days=self.settings.password_reset_retention_days)
        factory = get_session_factory(self.settings.database_url)
        with factory() as session:
            count = session.execute(delete(AccountRegistration).where(AccountRegistration.expires_at < cutoff)).rowcount or 0
            session.commit()
        return {"registration_pruned": count} if count else {}
