from __future__ import annotations

from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import secrets

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import AccountRegistration, AccountRegistrationDelivery, Household, SecurityAuditEvent, User
from app.models.enums import UserRole
from app.security.passwords import hash_parent_password
from app.security.registrations import digest_registration_token, format_registration_token, parse_registration_token
from app.services.password_resets import normalize_recovery_email

_EMAIL_DOMAIN = b"family-manager.registration.rate.email.v1\0"
_IP_DOMAIN = b"family-manager.registration.rate.ip.v1\0"


def _rate_hash(domain: bytes, value: str, pepper: str) -> str:
    return hmac.new(pepper.encode(), domain + value.encode(), hashlib.sha256).hexdigest()


class RegistrationService:
    def __init__(self, *, settings) -> None:
        self.settings = settings

    def request(self, session: Session, *, email: str, password: str, household_name: str, timezone: str, ip_address: str) -> None:
        if not self.settings.registration_enabled:
            return
        normalized = normalize_recovery_email(email)
        if normalized is None:
            return
        now = datetime.now(UTC)
        email_hash = _rate_hash(_EMAIL_DOMAIN, normalized, self.settings.password_reset_rate_limit_pepper)
        ip_hash = _rate_hash(_IP_DOMAIN, (ip_address or "unknown")[:64], self.settings.password_reset_rate_limit_pepper)
        # A public caller always gets the same acknowledgement. Existing users,
        # cooldowns, and IP limits therefore disclose no account state.
        if session.scalar(select(User.id).where(User.email == normalized)) is not None:
            return
        window = now - timedelta(seconds=self.settings.registration_request_window_seconds)
        if (session.scalar(select(func.count()).select_from(AccountRegistration).where(AccountRegistration.ip_key_hash == ip_hash, AccountRegistration.created_at >= window)) or 0) >= self.settings.registration_ip_window_limit:
            return
        existing = session.scalar(select(AccountRegistration).where(AccountRegistration.email_key_hash == email_hash, AccountRegistration.consumed_at.is_(None), AccountRegistration.invalidated_at.is_(None)))
        if existing is not None:
            if existing.created_at >= window:
                return
            existing.invalidated_at = now
            delivery = session.scalar(select(AccountRegistrationDelivery).where(AccountRegistrationDelivery.registration_id == existing.id))
            if delivery and delivery.status in {"pending", "processing", "retry"}:
                delivery.status = "cancelled"
                delivery.terminal_at = now
        password_hash = hash_parent_password(password)
        key_version = self.settings.password_reset_active_token_key_version
        registration_id = secrets.token_urlsafe(32)
        token = format_registration_token(registration_id, key_version=key_version, token_keys=self.settings.password_reset_token_keys)
        row = AccountRegistration(
            id=registration_id,
            email=normalized, email_key_hash=email_hash, ip_key_hash=ip_hash,
            household_name=household_name.strip(), timezone=timezone.strip() or "UTC",
            password_hash=password_hash, token_key_version=key_version,
            token_digest=digest_registration_token(token, key_version=key_version, token_keys=self.settings.password_reset_token_keys),
            expires_at=now + timedelta(seconds=self.settings.registration_token_ttl_seconds),
        )
        session.add(row)
        session.flush()
        session.add(AccountRegistrationDelivery(registration_id=row.id, status="pending", available_at=now))
        session.add(SecurityAuditEvent(event_type="registration.requested", ip_address="redacted", details_json='{"outcome":"accepted"}'))

    def verify(self, session: Session, *, token: str) -> User | None:
        if not self.settings.registration_enabled:
            return None
        now = datetime.now(UTC)
        try:
            key_version, registration_id, proof = parse_registration_token(token)
            expected = format_registration_token(registration_id, key_version=key_version, token_keys=self.settings.password_reset_token_keys).rsplit(".", 1)[1]
            if not hmac.compare_digest(proof, expected):
                return None
            digest = digest_registration_token(token, key_version=key_version, token_keys=self.settings.password_reset_token_keys)
        except Exception:
            return None
        registration = session.scalar(select(AccountRegistration).where(
            AccountRegistration.id == registration_id,
            AccountRegistration.token_digest == digest,
            AccountRegistration.consumed_at.is_(None),
            AccountRegistration.invalidated_at.is_(None),
            AccountRegistration.expires_at > now,
        ).with_for_update())
        if registration is None or session.scalar(select(User.id).where(User.email == registration.email)) is not None:
            return None
        try:
            with session.begin_nested():
                # The migrated schema requires owner_user_id on the household's
                # first INSERT. Preallocate a JSON-safe positive integer ID;
                # the household FK is DEFERRABLE, so the matching user can be
                # inserted later in the same transaction without ever creating
                # an ownerless household.
                owner_user_id = secrets.randbelow((1 << 53) - 1) + 1
                household = Household(
                    name=registration.household_name,
                    timezone=registration.timezone,
                    owner_user_id=owner_user_id,
                )
                session.add(household)
                session.flush()
                user = User(
                    id=owner_user_id,
                    household_id=household.id,
                    email=registration.email,
                    password_hash=registration.password_hash,
                    role=UserRole.PARENT_ADMIN,
                    active=True,
                )
                session.add(user)
                session.flush()
                registration.consumed_at = now
                session.add(SecurityAuditEvent(event_type="registration.completed", target_user_id=user.id, household_id=household.id, ip_address="redacted", details_json="{}"))
                session.flush()
                return user
        except IntegrityError:
            return None
