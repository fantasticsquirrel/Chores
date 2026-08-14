from __future__ import annotations

from datetime import UTC, datetime, timedelta
from enum import Enum
import hashlib
import hmac
import secrets
from typing import Protocol

from email_validator import EmailNotValidError, validate_email
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.core import PasswordReset, PasswordResetDelivery, PasswordResetRequest, User
from app.models.enums import UserRole
from app.security.password_resets import digest_password_reset_token, format_password_reset_token

_RATE_EMAIL_DOMAIN = b"family-manager.password-reset.rate.email.v1\0"
_RATE_IP_DOMAIN = b"family-manager.password-reset.rate.ip.v1\0"


class PasswordResetSettings(Protocol):
    password_reset_enabled: bool
    password_reset_token_keys: tuple[tuple[str, str], ...]
    password_reset_active_token_key_version: str
    password_reset_rate_limit_pepper: str
    password_reset_token_ttl_seconds: int
    password_reset_account_cooldown_seconds: int
    password_reset_account_daily_limit: int
    password_reset_ip_window_seconds: int
    password_reset_ip_window_limit: int
    password_reset_ip_daily_limit: int
    password_reset_household_daily_limit: int
    password_reset_response_floor_ms: int


class PasswordResetOutcome(str, Enum):
    ISSUED = "issued"
    INELIGIBLE = "ineligible"
    THROTTLED = "throttled"
    DISABLED = "disabled"


def _normalize_timestamp(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def normalize_recovery_email(email: str) -> str | None:
    """Normalize a syntactically usable, routable email without MX queries."""
    try:
        normalized = validate_email(email.strip(), check_deliverability=False).normalized
    except (EmailNotValidError, AttributeError, TypeError):
        return None
    local, separator, domain = normalized.rpartition("@")
    if not separator or not local or not domain:
        return None
    normalized_domain = domain.casefold().rstrip(".")
    if normalized_domain == "localhost" or normalized_domain.endswith(".localhost") or normalized_domain.endswith(".local"):
        return None
    # Prevent accidental reset mail for address-literal/private-only recipient forms.
    if normalized_domain.startswith("[") and normalized_domain.endswith("]"):
        return None
    return f"{local.casefold()}@{normalized_domain}"


def _rate_hash(purpose: bytes, value: str, pepper: str) -> str:
    return hmac.new(
        pepper.encode("utf-8"),
        purpose + value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _utc_database_cutoff(now: datetime, seconds: int) -> datetime:
    return now - timedelta(seconds=seconds)


class PasswordResetService:
    """Issue one-time reset capabilities without performing request-time I/O."""

    def __init__(self, *, settings: PasswordResetSettings) -> None:
        self._settings = settings

    def request_password_reset(
        self,
        session: Session,
        *,
        email: str,
        ip_address: str,
        now: datetime | None = None,
    ) -> PasswordResetOutcome:
        # The default/offline posture is a true no-op.  Returning the public
        # acknowledgement without writing request/audit rows avoids turning a
        # disabled recovery endpoint into an unbounded anonymous database-write
        # surface before the approved mail delivery controls are active.
        if not self._settings.password_reset_enabled:
            return PasswordResetOutcome.DISABLED

        now = _normalize_timestamp(now or datetime.now(UTC))
        supplied_email = email.strip().casefold()[:320] if isinstance(email, str) else ""
        normalized_email = normalize_recovery_email(email) if isinstance(email, str) else None
        email_key = _rate_hash(_RATE_EMAIL_DOMAIN, normalized_email or supplied_email, self._settings.password_reset_rate_limit_pepper)
        ip_key = _rate_hash(_RATE_IP_DOMAIN, (ip_address or "unknown")[:64], self._settings.password_reset_rate_limit_pepper)

        user = None
        if normalized_email:
            candidate = session.scalar(select(User).where(User.email == normalized_email))
            if candidate and candidate.active and candidate.role in {UserRole.PARENT, UserRole.PARENT_ADMIN}:
                user = candidate

        outcome = self._decide_outcome(
            session,
            user=user,
            email_key=email_key,
            ip_key=ip_key,
            now=now,
        )
        request = PasswordResetRequest(
            user_id=user.id if user is not None else None,
            household_id=user.household_id if user is not None else None,
            email_key_hash=email_key,
            ip_key_hash=ip_key,
            outcome=outcome.value,
            created_at=now,
        )
        session.add(request)

        if outcome is not PasswordResetOutcome.ISSUED:
            self._audit(session, event_type="password_reset.request_not_issued", user=user, outcome=outcome)
            return outcome

        assert user is not None
        try:
            with session.begin_nested():
                return self._issue(session, user=user, now=now)
        except IntegrityError:
            # The partial unique index is the race-proof backstop. A competing
            # issuance won; record a non-enumerating throttle outcome without
            # rolling back the caller's outer request-history transaction.
            request.outcome = PasswordResetOutcome.THROTTLED.value
            self._audit(
                session,
                event_type="password_reset.request_not_issued",
                user=user,
                outcome=PasswordResetOutcome.THROTTLED,
            )
            return PasswordResetOutcome.THROTTLED

    def invalidate_active_resets(self, session: Session, *, user_id: int, now: datetime | None = None) -> int:
        """Invalidate all outstanding capabilities when an authenticated credential changes."""
        current = _normalize_timestamp(now or datetime.now(UTC))
        result = session.execute(
            update(PasswordReset)
            .where(
                PasswordReset.user_id == user_id,
                PasswordReset.consumed_at.is_(None),
                PasswordReset.invalidated_at.is_(None),
            )
            .values(invalidated_at=current)
        )
        active_ids = select(PasswordReset.id).where(
            PasswordReset.user_id == user_id,
            PasswordReset.invalidated_at == current,
        )
        session.execute(
            update(PasswordResetDelivery)
            .where(
                PasswordResetDelivery.kind == "reset_link",
                PasswordResetDelivery.status.in_(("pending", "retry", "processing")),
                PasswordResetDelivery.password_reset_id.in_(active_ids),
            )
            .values(status="cancelled", terminal_at=current, lease_expires_at=None, last_error_code="invalidated")
        )
        return result.rowcount or 0

    def consume_password_reset(
        self,
        session: Session,
        *,
        token: str,
        new_password: str,
        now: datetime | None = None,
    ) -> User | None:
        """Atomically consume a valid opaque token and update its parent password."""
        # Disabling recovery is an emergency stop for both issuance and use. A
        # capability minted before that switch must not remain redeemable.
        if not self._settings.password_reset_enabled:
            return None
        from app.security.passwords import hash_parent_password, validate_parent_password
        from app.security.password_resets import PasswordResetTokenError, parse_password_reset_token

        current = _normalize_timestamp(now or datetime.now(UTC))
        try:
            key_version, reset_id, proof = parse_password_reset_token(token)
        except (PasswordResetTokenError, UnicodeEncodeError):
            return None
        if key_version not in dict(self._settings.password_reset_token_keys):
            return None
        try:
            expected_proof = format_password_reset_token(
                reset_id,
                key_version=key_version,
                token_keys=self._settings.password_reset_token_keys,
            ).rsplit(".", 1)[1]
        except PasswordResetTokenError:
            return None
        if not hmac.compare_digest(proof, expected_proof):
            return None
        digest = digest_password_reset_token(
            token,
            key_version=key_version,
            token_keys=self._settings.password_reset_token_keys,
        )
        reset = session.scalar(
            select(PasswordReset).where(
                PasswordReset.token_key_version == key_version,
                PasswordReset.token_digest == digest,
                PasswordReset.consumed_at.is_(None),
                PasswordReset.invalidated_at.is_(None),
                PasswordReset.expires_at > current,
            )
        )
        if reset is None:
            return None
        user = session.get(User, reset.user_id)
        if user is None or not user.active or user.role not in {UserRole.PARENT, UserRole.PARENT_ADMIN}:
            return None
        try:
            validate_parent_password(new_password)
        except ValueError:
            # The public confirmation endpoint deliberately does not distinguish
            # password-policy failure from invalid capability failure.
            return None

        # This conditional update is the one-time-consumption boundary. It wins
        # exactly once across concurrent confirmation requests.
        claimed = session.execute(
            update(PasswordReset)
            .where(
                PasswordReset.id == reset.id,
                PasswordReset.token_digest == digest,
                PasswordReset.consumed_at.is_(None),
                PasswordReset.invalidated_at.is_(None),
                PasswordReset.expires_at > current,
            )
            .execution_options(synchronize_session=False)
            .values(consumed_at=current)
        )
        if claimed.rowcount != 1:
            return None
        user.password_hash = hash_parent_password(new_password)
        session.execute(
            update(PasswordReset)
            .where(
                PasswordReset.user_id == user.id,
                PasswordReset.id != reset.id,
                PasswordReset.consumed_at.is_(None),
                PasswordReset.invalidated_at.is_(None),
            )
            .values(invalidated_at=current)
        )
        session.execute(
            update(PasswordResetDelivery)
            .where(
                PasswordResetDelivery.password_reset_id == reset.id,
                PasswordResetDelivery.kind == "reset_link",
                PasswordResetDelivery.status.in_(("pending", "retry", "processing")),
            )
            .values(status="cancelled", terminal_at=current, lease_expires_at=None, last_error_code="consumed")
        )
        session.add(
            PasswordResetDelivery(
                password_reset_id=reset.id,
                kind="password_changed",
                status="pending",
                available_at=current,
                created_at=current,
            )
        )
        self._audit(session, event_type="password_reset.completed", user=user, outcome=PasswordResetOutcome.ISSUED)
        return user

    def _decide_outcome(
        self,
        session: Session,
        *,
        user: User | None,
        email_key: str,
        ip_key: str,
        now: datetime,
    ) -> PasswordResetOutcome:
        if not self._settings.password_reset_enabled:
            return PasswordResetOutcome.DISABLED

        ip_window_cutoff = _utc_database_cutoff(now, self._settings.password_reset_ip_window_seconds)
        daily_cutoff = _utc_database_cutoff(now, 24 * 60 * 60)
        ip_window_count = session.scalar(
            select(func.count(PasswordResetRequest.id)).where(
                PasswordResetRequest.ip_key_hash == ip_key,
                PasswordResetRequest.created_at >= ip_window_cutoff,
            )
        ) or 0
        ip_daily_count = session.scalar(
            select(func.count(PasswordResetRequest.id)).where(
                PasswordResetRequest.ip_key_hash == ip_key,
                PasswordResetRequest.created_at >= daily_cutoff,
            )
        ) or 0
        if (
            ip_window_count >= self._settings.password_reset_ip_window_limit
            or ip_daily_count >= self._settings.password_reset_ip_daily_limit
        ):
            return PasswordResetOutcome.THROTTLED

        if user is None:
            return PasswordResetOutcome.INELIGIBLE

        latest_issued_at = session.scalar(
            select(func.max(PasswordResetRequest.created_at)).where(
                PasswordResetRequest.user_id == user.id,
                PasswordResetRequest.outcome == PasswordResetOutcome.ISSUED.value,
            )
        )
        # A cooldown preserves a usable mail link; it must never strand a user
        # behind a capability that has already expired or been invalidated.
        has_usable_reset = session.scalar(
            select(PasswordReset.id)
            .where(
                PasswordReset.user_id == user.id,
                PasswordReset.consumed_at.is_(None),
                PasswordReset.invalidated_at.is_(None),
                PasswordReset.expires_at > now,
            )
            .limit(1)
        ) is not None
        if (
            has_usable_reset
            and latest_issued_at is not None
            and _normalize_timestamp(latest_issued_at) > _utc_database_cutoff(now, self._settings.password_reset_account_cooldown_seconds)
        ):
            return PasswordResetOutcome.THROTTLED

        account_daily_count = session.scalar(
            select(func.count(PasswordResetRequest.id)).where(
                PasswordResetRequest.user_id == user.id,
                PasswordResetRequest.outcome == PasswordResetOutcome.ISSUED.value,
                PasswordResetRequest.created_at >= daily_cutoff,
            )
        ) or 0
        household_daily_count = session.scalar(
            select(func.count(PasswordResetRequest.id)).where(
                PasswordResetRequest.household_id == user.household_id,
                PasswordResetRequest.outcome == PasswordResetOutcome.ISSUED.value,
                PasswordResetRequest.created_at >= daily_cutoff,
            )
        ) or 0
        if (
            account_daily_count >= self._settings.password_reset_account_daily_limit
            or household_daily_count >= self._settings.password_reset_household_daily_limit
        ):
            return PasswordResetOutcome.THROTTLED
        return PasswordResetOutcome.ISSUED

    def _issue(self, session: Session, *, user: User, now: datetime) -> PasswordResetOutcome:
        # A non-throttled accepted request intentionally replaces prior usable
        # links. The request audit is retained, but raw recipient/token data is not.
        session.execute(
            update(PasswordReset)
            .where(
                PasswordReset.user_id == user.id,
                PasswordReset.consumed_at.is_(None),
                PasswordReset.invalidated_at.is_(None),
            )
            .values(invalidated_at=now)
        )
        key_version = self._settings.password_reset_active_token_key_version
        reset_id = secrets.token_urlsafe(32)
        token = format_password_reset_token(
            reset_id,
            key_version=key_version,
            token_keys=self._settings.password_reset_token_keys,
        )
        reset = PasswordReset(
            id=reset_id,
            user_id=user.id,
            token_key_version=key_version,
            token_digest=digest_password_reset_token(
                token,
                key_version=key_version,
                token_keys=self._settings.password_reset_token_keys,
            ),
            expires_at=now + timedelta(seconds=self._settings.password_reset_token_ttl_seconds),
            created_at=now,
        )
        session.add(reset)
        session.add(
            PasswordResetDelivery(
                password_reset_id=reset.id,
                kind="reset_link",
                status="pending",
                available_at=now,
                created_at=now,
            )
        )
        self._audit(session, event_type="password_reset.requested", user=user, outcome=PasswordResetOutcome.ISSUED)
        session.flush()
        return PasswordResetOutcome.ISSUED

    @staticmethod
    def _audit(
        session: Session,
        *,
        event_type: str,
        user: User | None,
        outcome: PasswordResetOutcome,
    ) -> None:
        # Import here to keep this service request-context independent: it never
        # needs raw request email/IP and must not persist either in audit JSON.
        from app.models.core import SecurityAuditEvent
        import json

        session.add(
            SecurityAuditEvent(
                event_type=event_type,
                target_user_id=user.id if user is not None else None,
                household_id=user.household_id if user is not None else None,
                ip_address="redacted",
                details_json=json.dumps({"outcome": outcome.value}, separators=(",", ":")),
            )
        )
