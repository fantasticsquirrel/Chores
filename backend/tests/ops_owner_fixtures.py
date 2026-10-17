"""Private, real database and session fixtures for owner dashboard tests."""
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.identity import Household, User, Child
from app.models.enums import PlatformRole, UserRole
from app.models.platform import PlatformUser, PlatformSession
from app.security.passwords import hash_password
from app.security.totp import generate_totp_secret, totp_code
from app.security.totp_crypto import encrypt_totp_secret


@pytest.fixture
def owner_env(tmp_path, monkeypatch):
    for key, value in {
        "APP_ENV": "test", "DATABASE_URL": f"sqlite:///{tmp_path / 'owner.db'}",
        "SECRET_KEY": "z" * 32, "SESSION_COOKIE_SECURE": "false",
        "PLATFORM_TOTP_ENCRYPTION_KEYS": "v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        "PLATFORM_TOTP_ACTIVE_KEY_VERSION": "v1",
    }.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    initialize_database(get_settings())
    sf = get_session_factory(get_settings().database_url)
    secret = generate_totp_secret()
    password_hash = hash_password("fixture-password")
    with sf() as db:
        db.add_all([
            Household(id=101, name="Literal_% Home", timezone="Europe/Berlin", owner_user_id=201),
            Household(id=102, name="Other Home", timezone="UTC", owner_user_id=204),
        ])
        db.flush()
        db.add(Child(id=301, household_id=101, name="Private Child"))
        db.flush()
        for id_, home, email, role, active, child_id in [
            (201, 101, "owner@example.com", UserRole.PARENT_ADMIN, True, None),
            (202, 101, "member-match@example.com", UserRole.PARENT_ADMIN, True, None),
            (203, 101, "member-match2@example.com", UserRole.PARENT, False, None),
            (204, 102, "other@example.com", UserRole.PARENT_ADMIN, True, None),
            (205, 101, "child-private@example.com", UserRole.CHILD, True, 301),
        ]:
            db.add(User(id=id_, household_id=home, email=email, role=role, active=active,
                        child_id=child_id, password_hash=password_hash))
        for id_, role in [(1, PlatformRole.OWNER), (2, PlatformRole.SUPPORT)]:
            db.add(PlatformUser(id=id_, email=f"ops{id_}@example.com", role=role,
                                password_hash=password_hash, active=True,
                                totp_secret_ciphertext=encrypt_totp_secret(secret), totp_key_version="v1"))
        db.commit()
    with TestClient(app) as client:
        yield {"client": client, "sf": sf, "secret": secret}


def login(env, role=1):
    response = env["client"].post("/ops-api/auth/login", json={
        "email": f"ops{role}@example.com", "password": "fixture-password", "totp_code": totp_code(env["secret"]),
    })
    assert response.status_code == 200
    return {"X-Ops-CSRF-Token": response.json()["csrf_token"]}


def age_session(env):
    with env["sf"]() as db:
        row = db.scalar(select(PlatformSession).where(PlatformSession.platform_user_id == 1))
        row.recent_reauth_at = datetime.now(UTC) - timedelta(hours=1)
        db.commit()


def reauth(env, headers):
    response = env["client"].post("/ops-api/auth/reauth", headers=headers, json={
        "password": "fixture-password", "totp_code": totp_code(env["secret"]),
    })
    assert response.status_code == 204
