from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import json
from pathlib import Path

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.db import get_engine, get_session_factory, initialize_database
from app.models import (
    Household,
    PasswordReset,
    PasswordResetDelivery,
    PasswordResetRequest,
    SecurityAuditEvent,
    User,
)
from app.models.enums import UserRole
from app.security import hash_password
from app.services.password_resets import PasswordResetOutcome, PasswordResetService


@dataclass(frozen=True)
class _ResetSettings:
    password_reset_enabled: bool = True
    password_reset_token_keys: tuple[tuple[str, str], ...] = (("v1", "t" * 32),)
    password_reset_active_token_key_version: str = "v1"
    password_reset_rate_limit_pepper: str = "r" * 32
    password_reset_token_ttl_seconds: int = 15 * 60
    password_reset_account_cooldown_seconds: int = 15 * 60
    password_reset_account_daily_limit: int = 3
    password_reset_ip_window_seconds: int = 15 * 60
    password_reset_ip_window_limit: int = 5
    password_reset_ip_daily_limit: int = 20
    password_reset_household_daily_limit: int = 8


@pytest.fixture(autouse=True)
def _clear_cached_engines() -> None:
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    yield
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


def _configure_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'password-reset-service.db'}")
    monkeypatch.setenv("SECRET_KEY", "s" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    initialize_database(get_settings())


def _seed_user(
    *,
    email: str,
    role: UserRole = UserRole.PARENT,
    active: bool = True,
    household_id: int | None = None,
) -> User:
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        if household_id is None:
            household = Household(name=f"Home {email}", timezone="UTC")
            session.add(household)
            session.flush()
            household_id = household.id
        if role is UserRole.CHILD:
            # The service never needs a child row, but ORM/schema invariants do.
            from app.models import Child

            child = Child(household_id=household_id, name=f"Child {email}", active=active)
            session.add(child)
            session.flush()
            child_id = child.id
        else:
            child_id = None
        user = User(
            household_id=household_id,
            email=email,
            password_hash=hash_password("existing-password-123"),
            role=role,
            child_id=child_id,
            active=active,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user


def _service(settings: _ResetSettings | None = None) -> PasswordResetService:
    return PasswordResetService(settings=settings or _ResetSettings())


def _rows(model: type[object]) -> list[object]:
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        return list(session.scalars(select(model)).all())


def test_issues_one_secret_free_reset_for_an_active_parent(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_database(tmp_path, monkeypatch)
    parent = _seed_user(email="parent@family-manager.dev")
    now = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)

    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        result = _service().request_password_reset(
            session,
            email=" Parent@Family-Manager.Dev ",
            ip_address="198.51.100.40",
            now=now,
        )
        session.commit()

    assert result is PasswordResetOutcome.ISSUED
    resets = _rows(PasswordReset)
    deliveries = _rows(PasswordResetDelivery)
    requests = _rows(PasswordResetRequest)
    audits = _rows(SecurityAuditEvent)
    assert len(resets) == len(deliveries) == len(requests) == 1
    reset = resets[0]
    delivery = deliveries[0]
    request = requests[0]
    assert isinstance(reset, PasswordReset)
    assert isinstance(delivery, PasswordResetDelivery)
    assert isinstance(request, PasswordResetRequest)
    assert reset.user_id == parent.id
    assert reset.token_key_version == "v1"
    assert len(reset.id) >= 43
    assert len(reset.token_digest) == 64
    assert reset.id not in reset.token_digest
    assert delivery.password_reset_id == reset.id
    assert delivery.kind == "reset_link"
    assert delivery.status == "pending"
    assert request.user_id == parent.id
    assert request.household_id == parent.household_id
    assert request.outcome == "issued"
    assert request.email_key_hash != parent.email
    assert request.ip_key_hash != "198.51.100.40"
    serialized_state = json.dumps(
        {
            "resets": [{"id": row.id, "digest": row.token_digest} for row in resets],
            "deliveries": [{"reset": row.password_reset_id, "error": row.last_error_code} for row in deliveries],
            "requests": [{"email": row.email_key_hash, "ip": row.ip_key_hash} for row in requests],
            "audits": [row.details_json for row in audits],
        },
        sort_keys=True,
    )
    assert parent.email not in serialized_state
    assert "198.51.100.40" not in serialized_state
    assert any(event.event_type == "password_reset.requested" for event in audits)


def test_disabled_reset_request_performs_no_persistent_work(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Disabled recovery must not leave an unbounded anonymous-write surface."""
    _configure_database(tmp_path, monkeypatch)
    parent = _seed_user(email="parent@family-manager.dev")
    factory = get_session_factory(get_settings().database_url)

    with factory() as session:
        result = _service(_ResetSettings(password_reset_enabled=False)).request_password_reset(
            session,
            email=parent.email,
            ip_address="198.51.100.40",
            now=datetime(2026, 8, 12, 12, 0, tzinfo=UTC),
        )
        session.commit()

    assert result is PasswordResetOutcome.DISABLED
    assert _rows(PasswordReset) == []
    assert _rows(PasswordResetDelivery) == []
    assert _rows(PasswordResetRequest) == []
    assert _rows(SecurityAuditEvent) == []


@pytest.mark.parametrize(
    "email,role,active,expected",
    [
        ("missing@example.com", UserRole.PARENT, True, PasswordResetOutcome.INELIGIBLE),
        ("disabled@example.com", UserRole.PARENT, False, PasswordResetOutcome.INELIGIBLE),
        ("child@example.com", UserRole.CHILD, True, PasswordResetOutcome.INELIGIBLE),
        ("not an address", UserRole.PARENT, True, PasswordResetOutcome.INELIGIBLE),
        ("parent@localhost", UserRole.PARENT, True, PasswordResetOutcome.INELIGIBLE),
        ("parent@house.local", UserRole.PARENT, True, PasswordResetOutcome.INELIGIBLE),
    ],
)
def test_ineligible_or_malformed_requests_only_write_redacted_rate_history(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    email: str,
    role: UserRole,
    active: bool,
    expected: PasswordResetOutcome,
) -> None:
    _configure_database(tmp_path, monkeypatch)
    if email not in {"missing@example.com", "not an address", "parent@localhost", "parent@house.local"}:
        _seed_user(email=email, role=role, active=active)
    elif email in {"parent@localhost", "parent@house.local"}:
        _seed_user(email=email, role=role, active=active)

    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        result = _service().request_password_reset(
            session,
            email=email,
            ip_address="203.0.113.55",
            now=datetime(2026, 8, 12, 12, 0, tzinfo=UTC),
        )
        session.commit()

    assert result is expected
    assert _rows(PasswordReset) == []
    assert _rows(PasswordResetDelivery) == []
    requests = _rows(PasswordResetRequest)
    assert len(requests) == 1
    request = requests[0]
    assert isinstance(request, PasswordResetRequest)
    assert len(request.email_key_hash) == len(request.ip_key_hash) == 64
    assert request.user_id is None
    assert request.household_id is None
    assert request.outcome == "ineligible"
    audits = _rows(SecurityAuditEvent)
    assert all(email not in event.details_json for event in audits if isinstance(event, SecurityAuditEvent))
    assert all("203.0.113.55" not in event.details_json for event in audits if isinstance(event, SecurityAuditEvent))


def test_account_cooldown_preserves_the_existing_usable_reset(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_database(tmp_path, monkeypatch)
    _seed_user(email="parent@family-manager.dev")
    now = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
    factory = get_session_factory(get_settings().database_url)

    with factory() as session:
        assert _service().request_password_reset(session, email="parent@family-manager.dev", ip_address="198.51.100.1", now=now) is PasswordResetOutcome.ISSUED
        session.commit()
    first = _rows(PasswordReset)[0]

    with factory() as session:
        assert _service().request_password_reset(
            session,
            email="parent@family-manager.dev",
            ip_address="198.51.100.2",
            now=now + timedelta(seconds=30),
        ) is PasswordResetOutcome.THROTTLED
        session.commit()

    resets = _rows(PasswordReset)
    deliveries = _rows(PasswordResetDelivery)
    assert len(resets) == len(deliveries) == 1
    assert isinstance(resets[0], PasswordReset)
    assert resets[0].id == first.id
    assert resets[0].invalidated_at is None
    assert isinstance(deliveries[0], PasswordResetDelivery)
    assert deliveries[0].status == "pending"
    assert [row.outcome for row in _rows(PasswordResetRequest)] == ["issued", "throttled"]


def test_per_ip_window_is_independent_of_login_attempt_tracking(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_database(tmp_path, monkeypatch)
    now = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
    settings = _ResetSettings(password_reset_ip_window_limit=2)
    factory = get_session_factory(get_settings().database_url)

    with factory() as session:
        for email in ("unknown-one@example.com", "unknown-two@example.com"):
            assert _service(settings).request_password_reset(
                session,
                email=email,
                ip_address="203.0.113.7",
                now=now,
            ) is PasswordResetOutcome.INELIGIBLE
            session.commit()
        assert _service(settings).request_password_reset(
            session,
            email="unknown-three@example.com",
            ip_address="203.0.113.7",
            now=now,
        ) is PasswordResetOutcome.THROTTLED
        session.commit()

    assert [row.outcome for row in _rows(PasswordResetRequest)] == ["ineligible", "ineligible", "throttled"]


def test_daily_account_and_household_caps_do_not_replace_existing_tokens(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_database(tmp_path, monkeypatch)
    first = _seed_user(email="first@example.com")
    second = _seed_user(email="second@example.com", household_id=first.household_id)
    now = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
    settings = _ResetSettings(
        password_reset_account_cooldown_seconds=1,
        password_reset_account_daily_limit=2,
        password_reset_household_daily_limit=2,
    )
    factory = get_session_factory(get_settings().database_url)

    with factory() as session:
        assert _service(settings).request_password_reset(session, email=first.email, ip_address="198.51.100.1", now=now) is PasswordResetOutcome.ISSUED
        session.commit()
        assert _service(settings).request_password_reset(session, email=first.email, ip_address="198.51.100.2", now=now + timedelta(seconds=2)) is PasswordResetOutcome.ISSUED
        session.commit()
        assert _service(settings).request_password_reset(session, email=first.email, ip_address="198.51.100.3", now=now + timedelta(seconds=4)) is PasswordResetOutcome.THROTTLED
        session.commit()
        assert _service(settings).request_password_reset(session, email=second.email, ip_address="198.51.100.4", now=now + timedelta(seconds=6)) is PasswordResetOutcome.THROTTLED
        session.commit()

    resets = _rows(PasswordReset)
    assert len(resets) == 2
    assert sum(reset.user_id == first.id and reset.invalidated_at is None for reset in resets if isinstance(reset, PasswordReset)) == 1
    assert all(reset.user_id != second.id for reset in resets if isinstance(reset, PasswordReset))
