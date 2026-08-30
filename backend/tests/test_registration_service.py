from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.models.core import AccountRegistration, AccountRegistrationDelivery, Household, User
from app.models.enums import UserRole
from app.security.registrations import format_registration_token
from app.services.registrations import RegistrationService


@dataclass(frozen=True)
class Settings:
    registration_enabled: bool = True
    password_reset_token_keys: tuple[tuple[str, str], ...] = (("v1", "k" * 32),)
    password_reset_active_token_key_version: str = "v1"
    password_reset_rate_limit_pepper: str = "p" * 32
    registration_token_ttl_seconds: int = 86400
    registration_request_window_seconds: int = 900
    registration_ip_window_limit: int = 5


def configure(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'registration.db'}")
    monkeypatch.setenv("SECRET_KEY", "s" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    initialize_database(get_settings())


def test_registration_creates_no_identity_until_single_use_verification(tmp_path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    factory = get_session_factory(get_settings().database_url)
    service = RegistrationService(settings=Settings())
    with factory() as session:
        service.request(session, email=" Owner@Example.com ", password="correct horse battery staple", household_name="Our Home", timezone="America/Chicago", ip_address="198.51.100.2")
        session.commit()
    with factory() as session:
        registration = session.scalar(select(AccountRegistration))
        assert registration is not None
        assert session.scalar(select(AccountRegistrationDelivery)) is not None
        assert session.scalar(select(User)) is None
        assert session.scalar(select(Household)) is None
        token = format_registration_token(registration.id, key_version=registration.token_key_version, token_keys=Settings().password_reset_token_keys)
        assert registration.password_hash != "correct horse battery staple"
        assert registration.token_digest != token
    with factory() as session:
        user = service.verify(session, token=token)
        assert user is not None
        session.commit()
        assert user.role is UserRole.PARENT_ADMIN
        household = session.get(Household, user.household_id)
        assert household is not None and household.owner_user_id == user.id
    with factory() as session:
        assert service.verify(session, token=token) is None


def test_existing_email_is_uniform_noop(tmp_path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        household = Household(name="Existing", timezone="UTC")
        session.add(household); session.flush()
        session.add(User(household_id=household.id, email="owner@example.com", password_hash="hash", role=UserRole.PARENT_ADMIN))
        session.commit()
    with factory() as session:
        RegistrationService(settings=Settings()).request(session, email="owner@example.com", password="correct horse battery staple", household_name="Other", timezone="UTC", ip_address="198.51.100.2")
        session.commit()
        assert session.scalar(select(AccountRegistration)) is None
