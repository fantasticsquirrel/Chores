from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from email.utils import make_msgid
from html import escape
import subprocess
from typing import Protocol
from urllib.parse import quote

from sqlalchemy import and_, delete, or_, select, update
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_session_factory
from app.models.core import PasswordReset, PasswordResetDelivery, PasswordResetRequest, User
from app.models.enums import UserRole
from app.security.password_resets import PasswordResetTokenError, format_password_reset_token
from app.services.password_resets import normalize_recovery_email

_RESET_FROM = "Family Manager <no-reply@family.multihost.ing>"
_RESET_SUBJECT = "Reset your Family Manager password"
_CHANGED_SUBJECT = "Your Family Manager password changed"


class MailSubmissionError(RuntimeError):
    """A deliberate, safe code for local-MTA handoff failures."""


class MailSubmitter(Protocol):
    def __call__(self, message_bytes: bytes) -> None: ...


@dataclass(frozen=True)
class _Claim:
    delivery_id: int
    lease_expires_at: datetime


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _same_timestamp(left: datetime | None, right: datetime) -> bool:
    return left is not None and _as_utc(left) == _as_utc(right)


class LocalSendmailAdapter:
    """Submit an RFC 5322 message to the local MTA with fixed argv only."""

    def __init__(self, *, path: str, timeout_seconds: int) -> None:
        self._path = path
        self._timeout_seconds = timeout_seconds

    def submit(self, message_bytes: bytes) -> None:
        try:
            subprocess.run(
                [self._path, "-t", "-i"],
                input=message_bytes,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=self._timeout_seconds,
                check=True,
                shell=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise MailSubmissionError("mta-timeout") from exc
        except subprocess.CalledProcessError as exc:
            raise MailSubmissionError("mta-rejected") from exc
        except OSError as exc:
            raise MailSubmissionError("mta-unavailable") from exc


def _fixed_message(*, recipient: str, subject: str) -> EmailMessage:
    message = EmailMessage()
    message["From"] = _RESET_FROM
    message["To"] = recipient
    message["Subject"] = subject
    message["Auto-Submitted"] = "auto-generated"
    message["Message-ID"] = make_msgid(domain="family.multihost.ing")
    return message


def render_reset_link_message(*, recipient: str, reset_url: str, expires_minutes: int) -> bytes:
    """Render a fixed, multipart reset message without interpolating account data."""
    message = _fixed_message(recipient=recipient, subject=_RESET_SUBJECT)
    plain = (
        "A request was made to reset your Family Manager password.\n\n"
        f"Use this link within {expires_minutes} minutes:\n{reset_url}\n\n"
        "If you did not request this, you can safely ignore this email. "
        "This no-reply address is not monitored."
    )
    safe_url = escape(reset_url, quote=True)
    html = (
        "<p>A request was made to reset your Family Manager password.</p>"
        f"<p><a href=\"{safe_url}\">Reset your password</a></p>"
        f"<p>This link expires in {expires_minutes} minutes.</p>"
        "<p>If you did not request this, you can safely ignore this email. "
        "This no-reply address is not monitored.</p>"
    )
    message.set_content(plain)
    message.add_alternative(html, subtype="html")
    return message.as_bytes()


def render_password_changed_message(*, recipient: str) -> bytes:
    """Render a token-free security notice after successful reset completion."""
    message = _fixed_message(recipient=recipient, subject=_CHANGED_SUBJECT)
    plain = (
        "Your Family Manager password was changed.\n\n"
        "If you did not make this change, use the Family Manager sign-in page to request help. "
        "This no-reply address is not monitored."
    )
    html = (
        "<p>Your Family Manager password was changed.</p>"
        "<p>If you did not make this change, use the Family Manager sign-in page to request help. "
        "This no-reply address is not monitored.</p>"
    )
    message.set_content(plain)
    message.add_alternative(html, subtype="html")
    return message.as_bytes()


class PasswordResetMailWorker:
    """Claim, render, and locally submit the secret-free reset-mail outbox."""

    def __init__(
        self,
        *,
        settings: Settings | object | None = None,
        submit: MailSubmitter | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._submit = submit or LocalSendmailAdapter(
            path=self._settings.password_reset_sendmail_path,
            timeout_seconds=self._settings.password_reset_sendmail_timeout_seconds,
        ).submit

    def process_pending(self, *, now: datetime | None = None, limit: int | None = None) -> dict[str, int]:
        """Run a bounded batch; only aggregate safe status counts are returned."""
        if not self._settings.password_reset_enabled:
            return {}
        current = _as_utc(now or datetime.now(UTC))
        batch_size = limit if limit is not None else self._settings.password_reset_worker_batch_size
        factory = get_session_factory(self._settings.database_url) if isinstance(self._settings, Settings) else get_session_factory(get_settings().database_url)
        with factory() as session:
            candidate_ids = list(
                session.scalars(
                    select(PasswordResetDelivery.id)
                    .where(self._claimable(current))
                    .order_by(PasswordResetDelivery.id)
                    .limit(batch_size)
                ).all()
            )

        counts: dict[str, int] = {}
        for delivery_id in candidate_ids:
            claim = self._claim(factory, delivery_id=delivery_id, now=current)
            if claim is None:
                continue
            outcome = self._send_claim(factory, claim=claim, now=current)
            if outcome is not None:
                counts[outcome] = counts.get(outcome, 0) + 1
        return counts

    def cleanup(self, *, now: datetime | None = None) -> dict[str, int]:
        """Cancel expired links and bound all reset-specific persisted metadata."""
        current = _as_utc(now or datetime.now(UTC))
        factory = get_session_factory(self._settings.database_url) if isinstance(self._settings, Settings) else get_session_factory(get_settings().database_url)
        with factory() as session:
            expired = session.execute(
                update(PasswordResetDelivery)
                .where(
                    PasswordResetDelivery.kind == "reset_link",
                    PasswordResetDelivery.status.in_(("pending", "retry")),
                    PasswordResetDelivery.password_reset_id.in_(
                        select(PasswordReset.id).where(PasswordReset.expires_at <= current)
                    ),
                )
                .values(status="cancelled", terminal_at=current, lease_expires_at=None, last_error_code="expired")
            ).rowcount or 0
            retention_cutoff = current - timedelta(days=self._settings.password_reset_retention_days)
            # Request history is used solely for bounded abuse controls. It has
            # no operational purpose after the retention window and contains
            # only keyed hashes, never raw account or IP values.
            pruned_requests = session.execute(
                delete(PasswordResetRequest).where(PasswordResetRequest.created_at < retention_cutoff)
            ).rowcount or 0
            # Every delivery belongs to one expiring reset row. Deleting expired
            # reset rows after retention cascades their terminal delivery state,
            # including local-MTA handoffs, without ever persisting a message.
            pruned_resets = session.execute(
                delete(PasswordReset).where(PasswordReset.expires_at < retention_cutoff)
            ).rowcount or 0
            session.commit()
        pruned = pruned_requests + pruned_resets
        return {key: value for key, value in {"cancelled": expired, "pruned": pruned}.items() if value}

    @staticmethod
    def _claimable(now: datetime):
        return or_(
            and_(PasswordResetDelivery.status == "pending", PasswordResetDelivery.available_at <= now),
            and_(PasswordResetDelivery.status == "retry", PasswordResetDelivery.available_at <= now),
            and_(
                PasswordResetDelivery.status == "processing",
                PasswordResetDelivery.lease_expires_at.is_not(None),
                PasswordResetDelivery.lease_expires_at <= now,
            ),
        )

    def _claim(self, factory, *, delivery_id: int, now: datetime) -> _Claim | None:
        lease_until = now + timedelta(seconds=self._settings.password_reset_delivery_lease_seconds)
        with factory() as session:
            result = session.execute(
                update(PasswordResetDelivery)
                .where(PasswordResetDelivery.id == delivery_id, self._claimable(now))
                .values(status="processing", lease_expires_at=lease_until)
            )
            session.commit()
        return _Claim(delivery_id=delivery_id, lease_expires_at=lease_until) if result.rowcount == 1 else None

    def _send_claim(self, factory, *, claim: _Claim, now: datetime) -> str | None:
        """Validate and submit one claim within its reset-state serialization boundary.

        Local-MTA acceptance is an external side effect, so it cannot share a
        database transaction atomically.  We instead take the reset row's write
        lock before the final validation and retain it until after that handoff
        is recorded.  A concurrent consume/invalidate therefore wins *before*
        validation (the link is cancelled) or *after* local-MTA acceptance; it
        cannot invalidate a capability between the final check and submission.
        The write lock is also deliberate for SQLite, where SELECT FOR UPDATE is
        advisory/no-op and the self-assignment establishes the same boundary.
        """
        with factory() as session:
            claimed_delivery = session.get(PasswordResetDelivery, claim.delivery_id)
            if (
                claimed_delivery is None
                or claimed_delivery.status != "processing"
                or not _same_timestamp(claimed_delivery.lease_expires_at, claim.lease_expires_at)
            ):
                return None

            # Keep the same lock order as reset consumption/invalidation:
            # PasswordReset first, then its delivery.  The conditional no-op
            # writes obtain SQLite's write serialization before raw capability
            # material is created; PostgreSQL additionally locks the rows.
            locked_reset = session.scalar(
                select(PasswordReset)
                .where(PasswordReset.id == claimed_delivery.password_reset_id)
                .with_for_update()
            )
            if locked_reset is None:
                return None
            reset_lock = session.execute(
                update(PasswordReset)
                .where(PasswordReset.id == locked_reset.id)
                .values(id=PasswordReset.id)
            )
            if reset_lock.rowcount != 1:
                return None
            locked_delivery = session.scalar(
                select(PasswordResetDelivery)
                .where(
                    PasswordResetDelivery.id == claim.delivery_id,
                    PasswordResetDelivery.status == "processing",
                    PasswordResetDelivery.lease_expires_at == claim.lease_expires_at,
                )
                .with_for_update()
            )
            if locked_delivery is None:
                return None
            delivery_lock = session.execute(
                update(PasswordResetDelivery)
                .where(PasswordResetDelivery.id == locked_delivery.id)
                .values(lease_expires_at=PasswordResetDelivery.lease_expires_at)
            )
            if delivery_lock.rowcount != 1:
                return None
            # Direct UPDATEs bypass ORM state tracking. Reload after acquiring
            # the SQLite writer lock so an invalidation that committed just
            # before that lock is never assessed through a stale identity map.
            session.expire_all()
            reset = session.get(PasswordReset, claimed_delivery.password_reset_id)
            delivery = session.get(PasswordResetDelivery, claim.delivery_id)
            user = session.scalar(
                select(User).where(User.id == reset.user_id).with_for_update()
            ) if reset is not None else None
            if delivery is None or delivery.status != "processing" or not _same_timestamp(delivery.lease_expires_at, claim.lease_expires_at):
                return None
            invalid = (
                reset is None
                or user is None
                or not user.active
                or user.role not in {UserRole.PARENT, UserRole.PARENT_ADMIN}
                or normalize_recovery_email(user.email) != user.email
            )
            if delivery.kind == "reset_link":
                invalid = invalid or reset.consumed_at is not None or reset.invalidated_at is not None or _as_utc(reset.expires_at) <= now
            elif delivery.kind == "password_changed":
                invalid = invalid or reset.consumed_at is None
            else:
                invalid = True
            if invalid:
                self._finalize(session, delivery, claim, status="cancelled", now=now, error_code="invalid-state", increment=False)
                session.commit()
                return "cancelled"

            recipient = user.email
            if delivery.kind == "reset_link":
                try:
                    token = format_password_reset_token(
                        reset.id,
                        key_version=reset.token_key_version,
                        token_keys=self._settings.password_reset_token_keys,
                    )
                except PasswordResetTokenError:
                    # A key may be retired after an outbox row was created. Do
                    # not abandon the committed claim or retry forever; a
                    # capability that can no longer be derived is unusable.
                    self._finalize(
                        session,
                        delivery,
                        claim,
                        status="cancelled",
                        now=now,
                        error_code="token-key-unavailable",
                        increment=False,
                    )
                    session.commit()
                    return "cancelled"
                reset_url = f"{self._settings.password_reset_public_app_url.rstrip('/')}/reset-password#token={quote(token, safe='._-')}"
                expires_minutes = max(1, int((_as_utc(reset.expires_at) - now).total_seconds() // 60))
                message = render_reset_link_message(recipient=recipient, reset_url=reset_url, expires_minutes=expires_minutes)
            else:
                message = render_password_changed_message(recipient=recipient)

            try:
                self._submit(message)
            except MailSubmissionError as exc:
                return self._handle_submission_failure(
                    session,
                    delivery=delivery,
                    reset=reset,
                    claim=claim,
                    now=now,
                    error_code=exc.args[0] if exc.args else "mta-failed",
                )
            except Exception:
                return self._handle_submission_failure(
                    session,
                    delivery=delivery,
                    reset=reset,
                    claim=claim,
                    now=now,
                    error_code="mta-unknown",
                )

            self._finalize(session, delivery, claim, status="accepted", now=now, error_code="", increment=True)
            session.commit()
        return "accepted"

    def _handle_submission_failure(
        self,
        session: Session,
        *,
        delivery: PasswordResetDelivery,
        reset: PasswordReset,
        claim: _Claim,
        now: datetime,
        error_code: str,
    ) -> str:
        """Finalize a failed handoff without releasing the reset-state lock."""
        safe_code = error_code if error_code in {"mta-timeout", "mta-rejected", "mta-unavailable", "mta-unknown"} else "mta-unknown"
        next_attempt = delivery.attempt_count + 1
        expired = _as_utc(reset.expires_at) <= now
        if expired:
            status = "cancelled"
        elif next_attempt >= self._settings.password_reset_delivery_max_attempts:
            status = "dead"
        else:
            status = "retry"
        delay = timedelta(seconds=30 * (2 ** max(0, next_attempt - 1)))
        available_at = now + delay
        if status == "retry" and available_at >= _as_utc(reset.expires_at):
            status = "cancelled"
        self._finalize(
            session,
            delivery,
            claim,
            status=status,
            now=now,
            error_code=safe_code,
            increment=True,
            available_at=available_at if status == "retry" else None,
        )
        session.commit()
        return status

    @staticmethod
    def _finalize(
        session: Session,
        delivery: PasswordResetDelivery,
        claim: _Claim,
        *,
        status: str,
        now: datetime,
        error_code: str,
        increment: bool,
        available_at: datetime | None = None,
    ) -> None:
        # The caller has verified this exact lease. An ORM update is safe here
        # because no other worker can own the row until its lease is stale.
        _ = session, claim
        delivery.status = status
        delivery.lease_expires_at = None
        delivery.last_error_code = error_code
        if increment:
            delivery.attempt_count += 1
        if status == "accepted":
            # This records local-MTA submission only, never recipient delivery.
            delivery.accepted_by_mta_at = now
            delivery.terminal_at = now
        elif status in {"cancelled", "dead"}:
            delivery.terminal_at = now
        elif status == "retry" and available_at is not None:
            delivery.available_at = available_at
