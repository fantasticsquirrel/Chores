from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
import logging
import time

from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.config import get_settings
from app.db import get_engine, get_session_factory, initialize_database
from app.main import app
from app.models import (
    AuthSession,
    Child,
    Household,
    PasswordReset,
    PasswordResetDelivery,
    PasswordResetRequest,
    SecurityAuditEvent,
    User,
)
from app.models.enums import UserRole
from app.security import hash_password, verify_password
from app.security import passwords as password_security
from app.security.csrf import CSRF_COOKIE_NAME, CSRF_HEADER_NAME
from app.security.password_resets import format_password_reset_token
from app.security.sessions import SESSION_COOKIE_NAME, create_session_token, resolve_session

GENERIC_ACK = "If an eligible account exists for that address, reset instructions will arrive shortly."
CONFIRM_ACK = "Try signing in. If you cannot sign in, request a new reset link."


def _configure(tmp_path: Path, monkeypatch, *, response_floor_ms: int = 1) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'password-reset-api.db'}")
    monkeypatch.setenv("SECRET_KEY", "s" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("PASSWORD_RESET_ENABLED", "true")
    monkeypatch.setenv("PASSWORD_RESET_PUBLIC_APP_URL", "https://family.multihost.ing/chore")
    monkeypatch.setenv("PASSWORD_RESET_FROM_ADDRESS", "no-reply@family.multihost.ing")
    monkeypatch.setenv("PASSWORD_RESET_SENDMAIL_PATH", "/bin/true")
    monkeypatch.setenv("PASSWORD_RESET_RESPONSE_FLOOR_MS", str(response_floor_ms))
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    initialize_database(get_settings())


def _seed_user(
    *,
    email: str,
    role: UserRole = UserRole.PARENT,
    active: bool = True,
    household_id: int | None = None,
) -> tuple[User, str]:
    factory = get_session_factory(get_settings().database_url)
    password = "existing parent password"
    with factory() as session:
        if household_id is None:
            household = Household(name=f"Home {email}", timezone="UTC")
            session.add(household)
            session.flush()
            household_id = household.id
        if role is UserRole.CHILD:
            child = Child(household_id=household_id, name=f"Child {email}", active=active)
            session.add(child)
            session.flush()
            child_id = child.id
        else:
            child_id = None
        user = User(
            household_id=household_id,
            email=email,
            password_hash=hash_password(password),
            role=role,
            child_id=child_id,
            active=active,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user, password


def _issue_token(email: str) -> str:
    with TestClient(app) as client:
        response = client.post("/chore-api/auth/password-reset/request", json={"email": email})
        assert response.status_code == 202
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        reset = session.scalar(select(PasswordReset).order_by(PasswordReset.created_at.desc()))
        assert reset is not None
        return format_password_reset_token(
            reset.id,
            key_version=reset.token_key_version,
            token_keys=get_settings().password_reset_token_keys,
        )


def _reset_rows() -> list[PasswordReset]:
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        return list(session.scalars(select(PasswordReset).order_by(PasswordReset.created_at)).all())


def test_public_request_is_non_enumerating_for_known_unknown_disabled_child_malformed_and_throttled(
    tmp_path: Path,
    monkeypatch,
) -> None:
    _configure(tmp_path, monkeypatch)
    parent, _ = _seed_user(email="parent@example.com")
    _seed_user(email="disabled@example.com", active=False, household_id=parent.household_id)
    _seed_user(email="child@example.com", role=UserRole.CHILD, household_id=parent.household_id)

    with TestClient(app) as client:
        responses = [
            client.post("/chore-api/auth/password-reset/request", json={"email": value}, headers={"X-Real-IP": "198.51.100.11"})
            for value in ("parent@example.com", "unknown@example.com", "disabled@example.com", "child@example.com", "not an email")
        ]
        # A sixth request on the same trusted-IP value reaches the app-level cap.
        responses.append(
            client.post(
                "/chore-api/auth/password-reset/request",
                json={"email": "another-unknown@example.com"},
                headers={"X-Real-IP": "198.51.100.11"},
            )
        )

    assert {(response.status_code, response.json().get("detail")) for response in responses} == {(202, GENERIC_ACK)}
    rows = _reset_rows()
    assert len(rows) == 1
    assert rows[0].user_id == parent.id


def test_disabled_public_request_uses_the_generic_ack_without_persisting_request_metadata(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    # Settings are read per request; retain all other isolated test settings.
    monkeypatch.setenv("PASSWORD_RESET_ENABLED", "false")
    get_settings.cache_clear()
    parent, _ = _seed_user(email="parent@example.com")

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/password-reset/request",
            json={"email": parent.email},
            headers={"X-Real-IP": "198.51.100.11"},
        )

    assert response.status_code == 202
    assert response.json() == {"detail": GENERIC_ACK}
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        assert session.scalar(select(PasswordReset)) is None
        assert session.scalar(select(PasswordResetDelivery)) is None
        assert session.scalar(select(PasswordResetRequest)) is None
        assert session.scalar(select(SecurityAuditEvent)) is None


def test_confirmation_admission_budget_rejects_a_valid_capability_without_mutation_when_saturated(
    tmp_path: Path,
    monkeypatch,
) -> None:
    """A cap applies equally to valid/invalid confirmations, avoiding a load oracle."""
    _configure(tmp_path, monkeypatch)
    parent, old_password = _seed_user(email="parent@example.com")
    token = _issue_token(parent.email)
    slots = password_security.BoundedSemaphore(1)
    assert slots.acquire(blocking=False)
    monkeypatch.setattr(password_security, "_password_reset_confirmation_slots", slots)
    try:
        with TestClient(app) as client:
            response = client.post(
                "/chore-api/auth/password-reset/confirm",
                json={"token": token, "new_password": "a sufficiently long novel parent password"},
            )
    finally:
        slots.release()

    assert response.status_code == 202
    assert response.json() == {"detail": CONFIRM_ACK}
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        reset = session.scalar(select(PasswordReset))
        user = session.get(User, parent.id)
        assert reset is not None and reset.consumed_at is None
        assert user is not None and verify_password(old_password, user.password_hash)


def test_disabled_confirmation_acknowledges_without_consuming_a_preissued_capability(tmp_path: Path, monkeypatch) -> None:
    """Turning recovery off is an emergency stop for both issuance and redemption."""
    _configure(tmp_path, monkeypatch)
    parent, old_password = _seed_user(email="parent@example.com")
    token = _issue_token(parent.email)
    monkeypatch.setenv("PASSWORD_RESET_ENABLED", "false")
    get_settings.cache_clear()

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/password-reset/confirm",
            json={"token": token, "new_password": "a sufficiently long novel parent password"},
        )

    assert response.status_code == 202
    assert response.json() == {"detail": CONFIRM_ACK}
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        reset = session.scalar(select(PasswordReset))
        user = session.get(User, parent.id)
        assert reset is not None and reset.consumed_at is None and reset.invalidated_at is None
        assert user is not None and verify_password(old_password, user.password_hash)
        assert user.session_generation == 0
        assert not any(event.event_type == "credential.password_reset" for event in session.scalars(select(SecurityAuditEvent)))


def test_public_request_keeps_generic_response_floor_and_accepts_a_stale_session_without_csrf(
    tmp_path: Path,
    monkeypatch,
) -> None:
    _configure(tmp_path, monkeypatch, response_floor_ms=40)
    parent, password = _seed_user(email="parent@example.com")

    with TestClient(app) as client:
        login = client.post("/chore-api/auth/login", json={"email": parent.email, "password": password})
        assert login.status_code == 200
        started = time.perf_counter()
        response = client.post("/chore-api/auth/password-reset/request", json={"email": "unknown@example.com"})
        elapsed = time.perf_counter() - started

    assert response.status_code == 202
    assert response.json() == {"detail": GENERIC_ACK}
    assert elapsed >= 0.03


def test_confirmation_consumes_once_revokes_all_sessions_clears_cookies_and_queues_security_notice(
    tmp_path: Path,
    monkeypatch,
) -> None:
    _configure(tmp_path, monkeypatch)
    parent, old_password = _seed_user(email="parent@example.com")
    token = _issue_token(parent.email)
    new_password = "a sufficiently long novel parent password"

    with TestClient(app) as first_client, TestClient(app) as copied_client:
        first_login = first_client.post("/chore-api/auth/login", json={"email": parent.email, "password": old_password})
        assert first_login.status_code == 200
        session_cookie = first_login.cookies[SESSION_COOKIE_NAME]
        copied_client.cookies.set(SESSION_COOKIE_NAME, session_cookie)

        response = first_client.post(
            "/chore-api/auth/password-reset/confirm",
            headers={
                "Origin": "https://family.multihost.ing",
                CSRF_HEADER_NAME: first_login.cookies[CSRF_COOKIE_NAME],
            },
            json={"token": token, "new_password": new_password},
        )
        assert response.status_code == 202
        assert response.json() == {"detail": CONFIRM_ACK}
        assert SESSION_COOKIE_NAME not in first_client.cookies
        assert CSRF_COOKIE_NAME not in first_client.cookies
        assert copied_client.get("/chore-api/auth/me").status_code == 401

        old_login = first_client.post("/chore-api/auth/login", json={"email": parent.email, "password": old_password})
        new_login = first_client.post("/chore-api/auth/login", json={"email": parent.email, "password": new_password})

    assert old_login.status_code == 401
    assert new_login.status_code == 200
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        reset = session.scalar(select(PasswordReset))
        assert reset is not None and reset.consumed_at is not None
        assert session.scalar(select(AuthSession).where(AuthSession.user_id == parent.id, AuthSession.revoked_at.is_(None))) is not None
        deliveries = list(session.scalars(select(PasswordResetDelivery).order_by(PasswordResetDelivery.id)).all())
        assert {(delivery.kind, delivery.status) for delivery in deliveries} >= {
            ("reset_link", "cancelled"),
            ("password_changed", "pending"),
        }
        user = session.get(User, parent.id)
        assert user is not None and verify_password(new_password, user.password_hash)


def test_confirmation_requires_csrf_and_canonical_origin_for_a_current_authenticated_session(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    parent, password = _seed_user(email="parent@example.com")
    token = _issue_token(parent.email)
    new_password = "a sufficiently long novel parent password"

    with TestClient(app) as client:
        login = client.post("/chore-api/auth/login", json={"email": parent.email, "password": password})
        assert login.status_code == 200
        csrf = client.cookies[CSRF_COOKIE_NAME]

        # A valid live browser session changes the CSRF contract: both its
        # double-submit value and the one canonical public origin are required.
        # Cookie-less recovery remains possible through the opaque capability.
        # Rejected CSRF attempts retain the generic completion acknowledgement;
        # they must not consume the capability or become cross-site logout
        # primitives.
        missing_origin = client.post(
            "/chore-api/auth/password-reset/confirm",
            headers={CSRF_HEADER_NAME: csrf},
            json={"token": token, "new_password": new_password},
        )
        assert missing_origin.status_code == 202
        assert missing_origin.json() == {"detail": CONFIRM_ACK}

        # A hostile site cannot drive reset confirmation even if it somehow has
        # a copied double-submit value.
        blocked = client.post(
            "/chore-api/auth/password-reset/confirm",
            headers={"Origin": "https://attacker.invalid", CSRF_HEADER_NAME: csrf},
            json={"token": token, "new_password": new_password},
        )
        assert blocked.status_code == 202
        assert blocked.json() == {"detail": CONFIRM_ACK}
        assert client.get("/chore-api/auth/me").status_code == 200

        with get_session_factory(get_settings().database_url)() as session:
            reset = session.scalar(select(PasswordReset))
            assert reset is not None and reset.consumed_at is None

        started = time.perf_counter()
        completed = client.post(
            "/chore-api/auth/password-reset/confirm",
            headers={"Origin": "https://family.multihost.ing", CSRF_HEADER_NAME: csrf},
            json={"token": token, "new_password": new_password},
        )
        elapsed = time.perf_counter() - started

    assert completed.status_code == 202
    assert completed.json() == {"detail": CONFIRM_ACK}
    assert elapsed >= 0.03


def test_confirmation_allows_recovery_when_only_an_invalid_stale_session_cookie_remains(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    parent, _ = _seed_user(email="parent@example.com")
    token = _issue_token(parent.email)

    with TestClient(app) as client:
        client.cookies.set(SESSION_COOKIE_NAME, "stale-not-an-authenticated-session")
        response = client.post(
            "/chore-api/auth/password-reset/confirm",
            headers={"Origin": "https://attacker.invalid"},
            json={"token": token, "new_password": "a sufficiently long novel parent password"},
        )

    assert response.status_code == 202
    assert response.json() == {"detail": CONFIRM_ACK}


def test_invalid_expired_revoked_and_replayed_confirmation_use_one_public_error(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    parent, _ = _seed_user(email="parent@example.com")
    token = _issue_token(parent.email)
    new_password = "a sufficiently long novel parent password"

    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        reset = session.scalar(select(PasswordReset))
        assert reset is not None
        reset.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        session.commit()

    with TestClient(app) as client:
        responses = [
            client.post("/chore-api/auth/password-reset/confirm", json={"token": "malformed", "new_password": new_password}),
            client.post("/chore-api/auth/password-reset/confirm", json={"token": token, "new_password": new_password}),
        ]

    assert {(response.status_code, response.json().get("detail")) for response in responses} == {(202, CONFIRM_ACK)}
    # A fresh valid token succeeds once, then is indistinguishable from other
    # outcomes at the public API boundary.
    fresh_token = _issue_token(parent.email)
    with TestClient(app) as client:
        accepted = client.post("/chore-api/auth/password-reset/confirm", json={"token": fresh_token, "new_password": new_password})
        replay = client.post("/chore-api/auth/password-reset/confirm", json={"token": fresh_token, "new_password": new_password})
    assert accepted.status_code == 202
    assert accepted.json() == {"detail": CONFIRM_ACK}
    assert replay.status_code == 202
    assert replay.json() == {"detail": CONFIRM_ACK}


def test_current_password_change_invalidates_active_reset_and_applies_parent_policy(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    parent, old_password = _seed_user(email="parent@example.com")
    _issue_token(parent.email)

    with TestClient(app) as client:
        login = client.post("/chore-api/auth/login", json={"email": parent.email, "password": old_password})
        csrf = login.cookies[CSRF_COOKIE_NAME]
        weak = client.post(
            "/chore-api/auth/change-password",
            headers={CSRF_HEADER_NAME: csrf},
            json={"current_password": old_password, "new_password": "short-pass"},
        )
        assert weak.status_code == 422
        changed = client.post(
            "/chore-api/auth/change-password",
            headers={CSRF_HEADER_NAME: csrf},
            json={"current_password": old_password, "new_password": "a sufficiently long current password change"},
        )
    assert changed.status_code == 204
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        reset = session.scalar(select(PasswordReset))
        assert reset is not None and reset.invalidated_at is not None
        delivery = session.scalar(select(PasswordResetDelivery).where(PasswordResetDelivery.kind == "reset_link"))
        assert delivery is not None and delivery.status == "cancelled"


def test_confirmation_logs_only_route_not_raw_token(tmp_path: Path, monkeypatch, caplog) -> None:
    _configure(tmp_path, monkeypatch)
    parent, _ = _seed_user(email="parent@example.com")
    token = _issue_token(parent.email)

    with caplog.at_level(logging.INFO):
        with TestClient(app) as client:
            response = client.post(
                "/chore-api/auth/password-reset/confirm",
                json={"token": token, "new_password": "a sufficiently long novel parent password"},
            )
    assert response.status_code == 202
    assert token not in caplog.text


def test_confirmation_rejects_non_ascii_token_with_the_same_public_error(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/password-reset/confirm",
            json={"token": "é", "new_password": "a sufficiently long novel parent password"},
        )

    assert response.status_code == 202
    assert response.json() == {"detail": CONFIRM_ACK}


def test_public_reset_validation_errors_are_non_enumerating_and_token_errors_are_uniform(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)

    with TestClient(app) as client:
        request_responses = [
            client.post("/chore-api/auth/password-reset/request", json={"email": 42}),
            client.post("/chore-api/auth/password-reset/request", json={"email": "x" * 321}),
            client.post("/chore-api/auth/password-reset/request", json={}),
            client.post("/chore-api/auth/password-reset/request", content=b"{"),
        ]
        confirm_responses = [
            client.post(
                "/chore-api/auth/password-reset/confirm",
                json={"token": 42, "new_password": "a sufficiently long novel parent password"},
            ),
            client.post(
                "/chore-api/auth/password-reset/confirm",
                json={"token": "x" * 1025, "new_password": "a sufficiently long novel parent password"},
            ),
            client.post("/chore-api/auth/password-reset/confirm", json={}),
            client.post("/chore-api/auth/password-reset/confirm", content=b"{"),
        ]

    for response in request_responses:
        assert response.status_code == 202
        assert response.json() == {"detail": GENERIC_ACK}
    for response in confirm_responses:
        assert response.status_code == 202
        assert response.json() == {"detail": CONFIRM_ACK}


def test_confirmation_acknowledgements_are_non_cacheable_and_no_referrer_for_success_invalid_and_malformed_input(
    tmp_path: Path,
    monkeypatch,
) -> None:
    """No confirmation branch may disclose state through response headers or caching policy."""
    _configure(tmp_path, monkeypatch)
    parent, _ = _seed_user(email="parent@example.com")
    token = _issue_token(parent.email)
    new_password = "a sufficiently long novel parent password"

    with TestClient(app) as client:
        malformed = client.post("/chore-api/auth/password-reset/confirm", content=b"{")
        invalid = client.post(
            "/chore-api/auth/password-reset/confirm",
            json={"token": "malformed", "new_password": new_password},
        )
        completed = client.post(
            "/chore-api/auth/password-reset/confirm",
            json={"token": token, "new_password": new_password},
        )

    for response in (malformed, invalid, completed):
        assert response.status_code == 202
        assert response.json() == {"detail": CONFIRM_ACK}
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["referrer-policy"] == "no-referrer"
        assert response.headers["x-content-type-options"] == "nosniff"


def test_malformed_confirmation_keeps_the_response_floor_when_the_timing_pad_is_unavailable(
    tmp_path: Path,
    monkeypatch,
) -> None:
    """Framework validation must retain the public floor even if Argon2 cannot run."""
    _configure(tmp_path, monkeypatch, response_floor_ms=40)
    monkeypatch.setattr(
        "app.security.passwords.burn_password_reset_confirmation_timing_budget",
        lambda: None,
    )

    with TestClient(app) as client:
        started = time.perf_counter()
        response = client.post("/chore-api/auth/password-reset/confirm", content=b"{")
        elapsed = time.perf_counter() - started

    assert response.status_code == 202
    assert response.json() == {"detail": CONFIRM_ACK}
    assert elapsed >= 0.03


def test_non_successful_public_confirmation_uses_the_password_timing_pad(tmp_path: Path, monkeypatch) -> None:
    """Malformed and invalid capabilities must not receive a cheap timing path."""
    _configure(tmp_path, monkeypatch)
    timing_pad_calls: list[str] = []
    monkeypatch.setattr(
        "app.security.passwords.burn_password_reset_confirmation_timing_budget",
        lambda: timing_pad_calls.append("called"),
    )

    with TestClient(app) as client:
        invalid = client.post(
            "/chore-api/auth/password-reset/confirm",
            json={"token": "malformed", "new_password": "a sufficiently long novel parent password"},
        )
        malformed = client.post("/chore-api/auth/password-reset/confirm", content=b"{")

    assert invalid.status_code == malformed.status_code == 202
    assert invalid.json() == malformed.json() == {"detail": CONFIRM_ACK}
    assert timing_pad_calls == ["called", "called"]


def test_malformed_public_reset_request_keeps_the_generic_response_floor(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch, response_floor_ms=40)

    with TestClient(app) as client:
        started = time.perf_counter()
        response = client.post("/chore-api/auth/password-reset/request", content=b"{")
        elapsed = time.perf_counter() - started

    assert response.status_code == 202
    assert response.json() == {"detail": GENERIC_ACK}
    assert elapsed >= 0.03


def test_parent_email_identity_change_invalidates_active_reset(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    parent, _ = _seed_user(email="parent@example.com")
    _issue_token(parent.email)

    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        user = session.get(User, parent.id)
        assert user is not None
        user.email = "updated-parent@example.com"
        session.commit()

    with factory() as session:
        reset = session.scalar(select(PasswordReset))
        assert reset is not None and reset.invalidated_at is not None
        delivery = session.scalar(select(PasswordResetDelivery).where(PasswordResetDelivery.kind == "reset_link"))
        assert delivery is not None and delivery.status == "cancelled"


def test_reset_credential_generation_rejects_a_stale_login_and_session_race(tmp_path: Path, monkeypatch) -> None:
    """A reset must invalidate a login that verified the old password just before it committed."""
    _configure(tmp_path, monkeypatch)
    parent, old_password = _seed_user(email="parent@example.com")
    token = _issue_token(parent.email)
    factory = get_session_factory(get_settings().database_url)

    with factory() as session:
        user = session.get(User, parent.id)
        assert user is not None
        assert verify_password(old_password, user.password_hash)
        stale_generation = user.session_generation
        existing_token = create_session_token(
            session,
            parent.id,
            max_age_seconds=get_settings().session_max_age_seconds,
            expected_session_generation=stale_generation,
        )
        assert existing_token is not None
        session.commit()

    with TestClient(app) as client:
        completed = client.post(
            "/chore-api/auth/password-reset/confirm",
            json={"token": token, "new_password": "a sufficiently long novel parent password"},
        )
    assert completed.status_code == 202

    with factory() as session:
        user = session.get(User, parent.id)
        assert user is not None
        assert user.session_generation == stale_generation + 1
        # A login which verified before reset must not be able to insert a
        # post-reset session by reusing its stale generation.
        assert (
            create_session_token(
                session,
                parent.id,
                max_age_seconds=get_settings().session_max_age_seconds,
                expected_session_generation=stale_generation,
            )
            is None
        )
        # Model the dangerous interleaving where a stale session row escaped a
        # revocation sweep. Generation matching in resolve_session is the
        # independent, fail-closed backstop.
        session.execute(
            update(AuthSession)
            .where(AuthSession.user_id == parent.id)
            .values(revoked_at=None)
        )
        session.expire_all()
        assert resolve_session(session, existing_token) is None
