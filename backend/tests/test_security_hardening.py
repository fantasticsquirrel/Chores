from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import AuthSession, Child, Household, SecurityAuditEvent, User
from app.models.enums import UserRole
from app.security import hash_password
from app.security.csrf import CSRF_COOKIE_NAME, CSRF_HEADER_NAME
from app.security.sessions import SESSION_COOKIE_NAME


def _setup(tmp_path: Path, monkeypatch, *, max_age: int = 120, attempts: int = 3) -> tuple[User, str]:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'security.db'}")
    monkeypatch.setenv("SECRET_KEY", "s" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("SESSION_MAX_AGE_SECONDS", str(max_age))
    monkeypatch.setenv("LOGIN_MAX_ATTEMPTS", str(attempts))
    monkeypatch.setenv("LOGIN_WINDOW_SECONDS", "300")
    get_settings.cache_clear()
    settings = get_settings()
    initialize_database(settings)
    factory = get_session_factory(settings.database_url)
    with factory() as session:
        household = Household(name="Home", timezone="UTC")
        session.add(household)
        session.flush()
        user = User(household_id=household.id, email="admin@example.com", password_hash=hash_password("password123"), role=UserRole.PARENT_ADMIN, child_id=None)
        session.add(user)
        session.commit()
        session.refresh(user)
        return user, "password123"


def _login(client: TestClient, user: User, password: str) -> tuple[str, str]:
    response = client.post("/chore-api/auth/login", json={"email": user.email, "password": password})
    assert response.status_code == 200
    return response.cookies[SESSION_COOKIE_NAME], response.cookies[CSRF_COOKIE_NAME]


def _copied_client(token: str, csrf: str | None = None) -> TestClient:
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, token)
    if csrf:
        client.cookies.set(CSRF_COOKIE_NAME, csrf)
    return client


def test_opaque_session_is_hashed_and_expires_at_configured_max_age(tmp_path: Path, monkeypatch) -> None:
    user, password = _setup(tmp_path, monkeypatch, max_age=1)
    with TestClient(app) as client:
        token, _ = _login(client, user, password)
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        row = session.scalar(select(AuthSession).where(AuthSession.user_id == user.id))
        assert row is not None
        assert row.token_hash != token
        row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        session.commit()
    with _copied_client(token) as copied:
        assert copied.get("/chore-api/auth/me").status_code == 401


def test_copied_session_is_revoked_by_logout(tmp_path: Path, monkeypatch) -> None:
    user, password = _setup(tmp_path, monkeypatch)
    with TestClient(app) as client:
        token, csrf = _login(client, user, password)
        assert client.post("/chore-api/auth/logout", headers={CSRF_HEADER_NAME: csrf}).status_code == 204
    with _copied_client(token) as copied:
        assert copied.get("/chore-api/auth/me").status_code == 401


def test_password_change_revokes_all_copied_sessions(tmp_path: Path, monkeypatch) -> None:
    user, password = _setup(tmp_path, monkeypatch)
    with TestClient(app) as client:
        token, csrf = _login(client, user, password)
        response = client.post("/chore-api/auth/change-password", headers={CSRF_HEADER_NAME: csrf}, json={"current_password": password, "new_password": "new-password-456"})
        assert response.status_code == 204
        assert SESSION_COOKIE_NAME not in client.cookies
        assert CSRF_COOKIE_NAME not in client.cookies
    with _copied_client(token) as copied:
        assert copied.get("/chore-api/auth/me").status_code == 401


def test_child_password_reset_and_disable_revoke_copied_session(tmp_path: Path, monkeypatch) -> None:
    admin, password = _setup(tmp_path, monkeypatch)
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        child = Child(household_id=admin.household_id, name="Ava", active=True)
        session.add(child)
        session.flush()
        child_user = User(household_id=admin.household_id, email="ava@example.com", password_hash=hash_password("kid-password"), role=UserRole.CHILD, child_id=child.id)
        session.add(child_user)
        session.commit()
        child_id = child.id
    with TestClient(app) as child_client:
        login = child_client.post("/chore-api/auth/child-login", json={"parent_email": admin.email, "child_name": "Ava", "password": "kid-password"})
        assert login.status_code == 200
        child_token = login.cookies[SESSION_COOKIE_NAME]
    with TestClient(app) as admin_client:
        _, csrf = _login(admin_client, admin, password)
        reset = admin_client.patch(f"/chore-api/children/{child_id}/account-password", headers={CSRF_HEADER_NAME: csrf}, json={"household_id": admin.household_id, "new_password": "kid-password-new"})
        assert reset.status_code == 200
    with _copied_client(child_token) as copied:
        assert copied.get("/chore-api/auth/me").status_code == 401
    with TestClient(app) as child_client:
        login = child_client.post("/chore-api/auth/child-login", json={"parent_email": admin.email, "child_name": "Ava", "password": "kid-password-new"})
        assert login.status_code == 200
        child_token = login.cookies[SESSION_COOKIE_NAME]
    with TestClient(app) as admin_client:
        _, csrf = _login(admin_client, admin, password)
        disabled = admin_client.patch(f"/chore-api/children/{child_id}", headers={CSRF_HEADER_NAME: csrf}, json={"household_id": admin.household_id, "active": False})
        assert disabled.status_code == 200
    with _copied_client(child_token) as copied:
        assert copied.get("/chore-api/auth/me").status_code == 401


@pytest.mark.parametrize("endpoint,payload", [
    ("/chore-api/auth/login", {"email": "admin@example.com", "password": "wrong"}),
    ("/chore-api/auth/child-login", {"parent_email": "admin@example.com", "child_name": "missing", "password": "wrong"}),
])
def test_login_abuse_is_bounded_with_generic_retry_after(tmp_path: Path, monkeypatch, endpoint: str, payload: dict[str, str]) -> None:
    _setup(tmp_path, monkeypatch, attempts=2)
    with TestClient(app) as client:
        first = client.post(endpoint, json=payload, headers={"X-Forwarded-For": "203.0.113.10"})
        second = client.post(endpoint, json=payload, headers={"X-Forwarded-For": "198.51.100.20"})
        blocked = client.post(endpoint, json=payload, headers={"X-Forwarded-For": "192.0.2.30"})
    assert first.status_code == second.status_code == 401
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0
    assert "invalid" not in blocked.json()["detail"].lower()


def test_successful_login_resets_recent_failure_budget(tmp_path: Path, monkeypatch) -> None:
    user, password = _setup(tmp_path, monkeypatch, attempts=2)
    with TestClient(app) as client:
        assert client.post("/chore-api/auth/login", json={"email": user.email, "password": "wrong"}).status_code == 401
        assert client.post("/chore-api/auth/login", json={"email": user.email, "password": password}).status_code == 200
        assert client.post("/chore-api/auth/login", json={"email": user.email, "password": "wrong"}).status_code == 401
        assert client.post("/chore-api/auth/login", json={"email": user.email, "password": "wrong"}).status_code == 401


def test_successful_login_does_not_reset_another_accounts_ip_budget(tmp_path: Path, monkeypatch) -> None:
    victim, _ = _setup(tmp_path, monkeypatch, attempts=2)
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        attacker = User(
            household_id=victim.household_id,
            email="attacker@example.com",
            password_hash=hash_password("attacker-password"),
            role=UserRole.PARENT,
        )
        session.add(attacker)
        session.commit()

    with TestClient(app) as client:
        assert client.post("/chore-api/auth/login", json={"email": victim.email, "password": "wrong"}).status_code == 401
        assert client.post("/chore-api/auth/login", json={"email": attacker.email, "password": "attacker-password"}).status_code == 200
        assert client.post("/chore-api/auth/login", json={"email": victim.email, "password": "wrong"}).status_code == 401
        assert client.post("/chore-api/auth/login", json={"email": victim.email, "password": "wrong"}).status_code == 429


def test_security_events_are_structured_and_durable(tmp_path: Path, monkeypatch) -> None:
    user, password = _setup(tmp_path, monkeypatch)
    with TestClient(app) as client:
        assert client.post("/chore-api/auth/login", json={"email": user.email, "password": "wrong"}).status_code == 401
        _, csrf = _login(client, user, password)
        assert client.post("/chore-api/auth/logout", headers={CSRF_HEADER_NAME: csrf}).status_code == 204
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        events = list(session.scalars(select(SecurityAuditEvent).order_by(SecurityAuditEvent.id)).all())
        assert {event.event_type for event in events} >= {"login.failure", "login.success", "session.logout"}
        assert all(event.ip_address and event.details_json is not None for event in events)


def test_duplicate_child_name_failure_is_publicly_indistinguishable(tmp_path: Path, monkeypatch) -> None:
    admin, _ = _setup(tmp_path, monkeypatch)
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        for i in range(2):
            child = Child(household_id=admin.household_id, name="Ava", active=True)
            session.add(child)
            session.flush()
            session.add(User(household_id=admin.household_id, email=f"ava{i}@example.com", password_hash=hash_password("kid-password"), role=UserRole.CHILD, child_id=child.id))
        session.commit()
    with TestClient(app) as client:
        duplicate = client.post("/chore-api/auth/child-login", json={"parent_email": admin.email, "child_name": "Ava", "password": "kid-password"})
        unknown = client.post("/chore-api/auth/child-login", json={"parent_email": admin.email, "child_name": "Nobody", "password": "kid-password"})
    assert duplicate.status_code == unknown.status_code == 401
    assert duplicate.json() == unknown.json()
