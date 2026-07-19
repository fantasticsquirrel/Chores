from __future__ import annotations

from datetime import UTC, datetime, timedelta
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError

from app.config import SettingsError, get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.billing import BillingCustomerReference, Subscription
from app.models.core import Household, LoginAttempt, User
from app.models.enums import EntitlementStatus, PlatformRole, UserRole
from app.models.platform import PlatformAuditEvent, PlatformUser
from app.schemas.platform import ComplimentaryRequest, ReconcileRequest, SupportCaseCreate
from app.security.passwords import hash_password
from app.security.totp import generate_totp_secret, totp_code
from app.security.totp_crypto import decrypt_totp_secret, encrypt_totp_secret
from app.services.billing import apply_event
from app.services.platform_bootstrap import create_platform_user, write_enrollment_secret

TEST_TOTP_KEY = "v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="


def configure(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'review.db'}")
    monkeypatch.setenv("SECRET_KEY", "z" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("PLATFORM_TOTP_ENCRYPTION_KEYS", TEST_TOTP_KEY)
    monkeypatch.setenv("PLATFORM_TOTP_ACTIVE_KEY_VERSION", "v1")
    get_settings.cache_clear()
    initialize_database(get_settings())


def seed_household_and_platform(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[dict[str, object], str]:
    configure(tmp_path, monkeypatch)
    sf = get_session_factory(get_settings().database_url)
    secret = generate_totp_secret()
    with sf() as db:
        # Explicit IDs allow the deferrable owner FK to close the household/user cycle.
        home = Household(id=101, name="Smith Family", timezone="UTC", owner_user_id=201)
        owner = User(id=201, household_id=101, email=" Owner.Smith@Example.COM ".strip().lower(), password_hash=hash_password("owner-password"), role=UserRole.PARENT_ADMIN, active=True)
        ops = PlatformUser(
            email="platform@example.com",
            password_hash=hash_password("platform-password"),
            role=PlatformRole.PLATFORM_OWNER,
            totp_secret_ciphertext=encrypt_totp_secret(secret),
            totp_key_version="v1",
            active=True,
        )
        db.add_all([home, owner, ops])
        db.commit()
    return {"household_id": 101, "owner_email": "owner.smith@example.com"}, secret


def login_ops(client: TestClient, secret: str) -> dict[str, str]:
    response = client.post("/ops-api/auth/login", json={"email": "platform@example.com", "password": "platform-password", "totp_code": totp_code(secret)})
    assert response.status_code == 200, response.text
    return {"X-Ops-CSRF-Token": response.json()["csrf_token"]}


def test_authority_and_entitlement_values_match_shared_contract() -> None:
    assert {role.value for role in PlatformRole} == {"PLATFORM_OWNER", "PLATFORM_SUPPORT"}
    assert {status.value for status in EntitlementStatus} == {
        "none", "trialing", "active", "grace_period", "billing_retry",
        "canceled_active", "expired", "refunded", "revoked", "complimentary",
    }


def test_reason_fields_strip_and_reject_whitespace() -> None:
    assert SupportCaseCreate(household_id=1, reason="  account help  ").reason == "account help"
    assert ReconcileRequest(case_id=1, reason="  projection drift  ").reason == "projection drift"
    assert ComplimentaryRequest(expires_at=datetime.now(UTC) + timedelta(days=1), reason="  recovery  ", idempotency_key=" key-1 ").reason == "recovery"
    for model, payload in (
        (SupportCaseCreate, {"household_id": 1, "reason": "   "}),
        (ReconcileRequest, {"case_id": 1, "reason": "   "}),
        (ComplimentaryRequest, {"expires_at": datetime.now(UTC) + timedelta(days=1), "reason": "   ", "idempotency_key": "key"}),
    ):
        with pytest.raises(ValidationError):
            model.model_validate(payload)


def test_totp_seed_is_encrypted_and_bootstrap_file_is_exclusive_0600(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    configure(tmp_path, monkeypatch)
    sf = get_session_factory(get_settings().database_url)
    with sf() as db:
        user, enrollment_secret = create_platform_user(db, email="secure@example.com", password="a-strong-platform-password", role=PlatformRole.PLATFORM_SUPPORT)
        db.commit()
        raw = db.execute(text("SELECT totp_secret_ciphertext, totp_key_version FROM platform_users WHERE id=:id"), {"id": user.id}).one()
        assert enrollment_secret not in raw[0]
        assert raw[1] == "v1"
        assert decrypt_totp_secret(raw[0], raw[1]) == enrollment_secret

    output = tmp_path / "enrollment.secret"
    write_enrollment_secret(output, enrollment_secret)
    assert output.read_text() == enrollment_secret + "\n"
    assert output.stat().st_mode & 0o777 == 0o600
    with pytest.raises(FileExistsError):
        write_enrollment_secret(output, "replacement")
    assert output.read_text() == enrollment_secret + "\n"


def test_provider_neutral_customer_and_subscription_identities_exist(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    configure(tmp_path, monkeypatch)
    columns = {column["name"] for column in inspect(get_settings and __import__("app.db", fromlist=["get_engine"]).get_engine(get_settings().database_url)).get_columns("subscriptions")}
    assert {"provider", "provider_subscription_id"} <= columns
    assert BillingCustomerReference.__tablename__ == "billing_customer_references"
    assert {"provider", "provider_customer_id"} <= {column.name for column in BillingCustomerReference.__table__.columns}
    assert {"provider", "provider_subscription_id"} <= {column.name for column in Subscription.__table__.columns}


def test_ops_reload_returns_usable_csrf_and_searches_id_email_and_name_redacted(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    household, secret = seed_household_and_platform(tmp_path, monkeypatch)
    with TestClient(app) as client:
        headers = login_ops(client, secret)
        me = client.get("/ops-api/auth/me")
        assert me.status_code == 200
        assert me.json()["csrf_token"] == headers["X-Ops-CSRF-Token"]
        for query in (str(household["household_id"]), " OWNER.SMITH@EXAMPLE.COM ", "smith"):
            response = client.get("/ops-api/households", params={"query": query})
            assert response.status_code == 200
            assert response.json() == [{"id": 101, "name": "Smith Family", "owner_email": "o***@example.com", "billing_status": "none"}]
            assert "owner.smith@example.com" not in response.text


def test_platform_login_rate_limit_is_durable_redacted_and_recovers(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _, secret = seed_household_and_platform(tmp_path, monkeypatch)
    monkeypatch.setenv("LOGIN_MAX_ATTEMPTS", "2")
    monkeypatch.setenv("LOGIN_WINDOW_SECONDS", "60")
    get_settings.cache_clear()
    with TestClient(app) as client:
        for _ in range(2):
            failed = client.post("/ops-api/auth/login", json={"email": " Platform@Example.com ", "password": "wrong", "totp_code": "000000"})
            assert failed.status_code == 401
        blocked = client.post("/ops-api/auth/login", json={"email": "platform@example.com", "password": "platform-password", "totp_code": totp_code(secret)})
        assert blocked.status_code == 429
        assert int(blocked.headers["Retry-After"]) > 0

    sf = get_session_factory(get_settings().database_url)
    with sf() as db:
        attempts = db.scalars(select(LoginAttempt).where(LoginAttempt.succeeded.is_(False))).all()
        assert len(attempts) == 2
        audits = db.scalars(select(PlatformAuditEvent).where(PlatformAuditEvent.event_type == "platform.login_failure")).all()
        assert len(audits) == 2
        assert all("platform@example.com" not in row.details_json.lower() and "000000" not in row.details_json for row in audits)
        db.execute(text("UPDATE login_attempts SET created_at=:old"), {"old": datetime.now(UTC) - timedelta(minutes=2)})
        db.commit()

    with TestClient(app) as client:
        recovered = client.post("/ops-api/auth/login", json={"email": "platform@example.com", "password": "platform-password", "totp_code": totp_code(secret)})
        assert recovered.status_code == 200


def test_production_rejects_insecure_cookie_and_missing_totp_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "z" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.delenv("PLATFORM_TOTP_ENCRYPTION_KEYS", raising=False)
    monkeypatch.delenv("PLATFORM_TOTP_ACTIVE_KEY_VERSION", raising=False)
    get_settings.cache_clear()
    with pytest.raises(SettingsError, match="SESSION_COOKIE_SECURE"):
        get_settings()


def test_apply_event_integrity_race_reloads_replay_or_conflict(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    configure(tmp_path, monkeypatch)
    sf = get_session_factory(get_settings().database_url)
    with sf() as db:
        home = Household(id=301, name="Race", timezone="UTC", owner_user_id=401)
        owner = User(id=401, household_id=301, email="race@example.com", password_hash="x", role=UserRole.PARENT, active=True)
        db.add_all([home, owner])
        db.commit()
        now = datetime.now(UTC)
        first = apply_event(db, household_id=301, source="platform", idempotency_key="race", event_type="grant", occurred_at=now, status=EntitlementStatus.ACTIVE, valid_until=None, payload={"value": 1})
        db.commit()
        assert first[2] is False
        replay = apply_event(db, household_id=301, source="platform", idempotency_key="race", event_type="grant", occurred_at=now, status=EntitlementStatus.ACTIVE, valid_until=None, payload={"value": 1})
        assert replay[2] is True
        with pytest.raises(ValueError, match="different event"):
            apply_event(db, household_id=301, source="platform", idempotency_key="race", event_type="grant", occurred_at=now, status=EntitlementStatus.ACTIVE, valid_until=None, payload={"value": 2})
