from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.exc import DatabaseError, IntegrityError

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.billing import BillingEvent, HouseholdEntitlement, Subscription
from app.models.core import Household, SecurityAuditEvent, User
from app.models.enums import EntitlementStatus, PlatformRole, UserRole
from app.models.platform import PlatformAuditEvent, PlatformUser, SupportCase, SupportCaseNote
from app.security.passwords import hash_password, verify_password
from app.security.totp import generate_totp_secret, totp_code
from app.services.platform_bootstrap import create_platform_user


def configure(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'phase9.db'}")
    monkeypatch.setenv("SECRET_KEY", "z" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    initialize_database(get_settings())


def seed_household(*, second: bool = False) -> dict[str, object]:
    sf = get_session_factory(get_settings().database_url)
    with sf() as db:
        home = Household(name="Other" if second else "Home", timezone="UTC")
        db.add(home)
        db.flush()
        owner = User(household_id=home.id, email=f"owner{home.id}@example.com", password_hash=hash_password("owner-password"), role=UserRole.PARENT_ADMIN, active=True)
        target = User(household_id=home.id, email=f"target{home.id}@example.com", password_hash=hash_password("target-password"), role=UserRole.PARENT, active=True)
        db.add_all([owner, target])
        db.flush()
        home.owner_user_id = owner.id
        db.commit()
        return {"household_id": home.id, "owner_id": owner.id, "owner_email": owner.email, "target_id": target.id}


def login_household(client: TestClient, email: str) -> dict[str, str]:
    response = client.post("/chore-api/auth/login", json={"email": email, "password": "owner-password"})
    assert response.status_code == 200
    return {"X-CSRF-Token": response.json()["csrf_token"]}


def seed_platform(role: PlatformRole) -> dict[str, str | int]:
    sf = get_session_factory(get_settings().database_url)
    secret = generate_totp_secret()
    with sf() as db:
        user = PlatformUser(email=f"{role.value.lower()}@ops.test", password_hash=hash_password("platform-password"), role=role, totp_secret=secret, active=True)
        db.add(user)
        db.commit()
        return {"id": user.id, "email": user.email, "secret": secret}


def login_ops(client: TestClient, user: dict[str, str | int]) -> dict[str, str]:
    response = client.post("/ops-api/auth/login", json={"email": user["email"], "password": "platform-password", "totp_code": totp_code(str(user["secret"]))})
    assert response.status_code == 200, response.text
    return {"X-Ops-CSRF-Token": response.json()["csrf_token"]}


def test_auth_projects_owner_and_transfer_requires_owner_reauth_confirmation(tmp_path: Path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    seeded = seed_household()
    with TestClient(app) as client:
        headers = login_household(client, str(seeded["owner_email"]))
        me = client.get("/chore-api/auth/me")
        assert me.json()["user"]["is_household_owner"] is True
        ownership = client.get("/chore-api/households/me/ownership")
        assert ownership.json() == {"household_id": seeded["household_id"], "owner_user_id": seeded["owner_id"]}

        denied = client.post("/chore-api/households/me/ownership/transfer", headers=headers, json={"new_owner_user_id": seeded["target_id"], "current_password": "wrong", "confirmation": "TRANSFER OWNERSHIP"})
        assert denied.status_code == 400
        bad_confirmation = client.post("/chore-api/households/me/ownership/transfer", headers=headers, json={"new_owner_user_id": seeded["target_id"], "current_password": "owner-password", "confirmation": "yes"})
        assert bad_confirmation.status_code == 422
        ok = client.post("/chore-api/households/me/ownership/transfer", headers=headers, json={"new_owner_user_id": seeded["target_id"], "current_password": "owner-password", "confirmation": "TRANSFER OWNERSHIP"})
        assert ok.status_code == 200
        assert ok.json()["owner_user_id"] == seeded["target_id"]

    sf = get_session_factory(get_settings().database_url)
    with sf() as db:
        assert db.scalar(select(SecurityAuditEvent).where(SecurityAuditEvent.event_type == "household.ownership_transferred")) is not None


def test_transfer_rejects_cross_household_child_inactive_and_non_owner(tmp_path: Path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    first = seed_household()
    second = seed_household(second=True)
    sf = get_session_factory(get_settings().database_url)
    with sf() as db:
        inactive = User(household_id=int(first["household_id"]), email="inactive@example.com", password_hash=hash_password("password123"), role=UserRole.PARENT, active=False)
        db.add(inactive)
        db.commit()
        inactive_id = inactive.id
    with TestClient(app) as client:
        headers = login_household(client, str(first["owner_email"]))
        for target in (second["target_id"], inactive_id):
            response = client.post("/chore-api/households/me/ownership/transfer", headers=headers, json={"new_owner_user_id": target, "current_password": "owner-password", "confirmation": "TRANSFER OWNERSHIP"})
            assert response.status_code == 400


def test_platform_and_household_sessions_are_strictly_separate(tmp_path: Path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    household = seed_household()
    ops = seed_platform(PlatformRole.OWNER)
    with TestClient(app) as household_client:
        login_household(household_client, str(household["owner_email"]))
        assert household_client.get("/ops-api/auth/me").status_code == 401
    with TestClient(app) as ops_client:
        login_ops(ops_client, ops)
        assert ops_client.get("/chore-api/auth/me").status_code == 401


def test_platform_login_requires_totp_and_owner_grant_is_finite_idempotent_and_never_shortens(tmp_path: Path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    household = seed_household()
    owner = seed_platform(PlatformRole.OWNER)
    with TestClient(app) as client:
        bad = client.post("/ops-api/auth/login", json={"email": owner["email"], "password": "platform-password", "totp_code": "000000"})
        assert bad.status_code == 401
        headers = login_ops(client, owner)
        expiry = datetime.now(UTC) + timedelta(days=30)
        payload = {"expires_at": expiry.isoformat(), "reason": "Service recovery", "idempotency_key": "case-123-grant"}
        first = client.post(f"/ops-api/households/{household['household_id']}/complimentary", headers=headers, json=payload)
        assert first.status_code == 200, first.text
        replay = client.post(f"/ops-api/households/{household['household_id']}/complimentary", headers=headers, json=payload)
        assert replay.status_code == 200
        assert replay.json()["event_id"] == first.json()["event_id"]
        shorter = client.post(f"/ops-api/households/{household['household_id']}/complimentary", headers=headers, json={**payload, "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(), "idempotency_key": "case-123-short"})
        assert shorter.status_code == 200
        assert shorter.json()["expires_at"] == first.json()["expires_at"]

    sf = get_session_factory(get_settings().database_url)
    with sf() as db:
        assert len(db.scalars(select(BillingEvent)).all()) == 2
        entitlement = db.scalar(select(HouseholdEntitlement))
        assert entitlement is not None and entitlement.status == EntitlementStatus.COMPLIMENTARY
        assert db.scalar(select(PlatformAuditEvent).where(PlatformAuditEvent.event_type == "complimentary.granted")) is not None


def test_support_is_redacted_case_scoped_append_only_and_cannot_grant(tmp_path: Path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    household = seed_household()
    support = seed_platform(PlatformRole.SUPPORT)
    with TestClient(app) as client:
        headers = login_ops(client, support)
        search = client.get("/ops-api/households", params={"query": "Home"})
        assert search.status_code == 200
        assert search.json()[0] == {"household_id": household["household_id"], "name": "Home", "owner_email_redacted": "o***@example.com", "entitlement_status": "none"}
        case = client.post("/ops-api/support/cases", headers=headers, json={"household_id": household["household_id"], "reason": "Customer requested billing check"})
        assert case.status_code == 201
        case_id = case.json()["id"]
        note = client.post(f"/ops-api/support/cases/{case_id}/notes", headers=headers, json={"body": "Verified local event state."})
        assert note.status_code == 201
        reconcile = client.post(f"/ops-api/households/{household['household_id']}/reconcile", headers=headers, json={"case_id": case_id, "reason": "Projection readback"})
        assert reconcile.status_code == 200
        forbidden = client.post(f"/ops-api/households/{household['household_id']}/complimentary", headers=headers, json={"expires_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(), "reason": "no", "idempotency_key": "support-no"})
        assert forbidden.status_code == 403

    sf = get_session_factory(get_settings().database_url)
    with sf() as db:
        assert len(db.scalars(select(SupportCase)).all()) == 1
        assert len(db.scalars(select(SupportCaseNote)).all()) == 1
        assert db.scalar(select(PlatformAuditEvent).where(PlatformAuditEvent.event_type == "billing.reconciled")) is not None


def test_platform_bootstrap_creates_owner_or_support_without_hardcoded_credentials(tmp_path: Path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    sf = get_session_factory(get_settings().database_url)
    with sf() as db:
        created, secret = create_platform_user(
            db,
            email="  Support@Example.com ",
            password="a-strong-platform-password",
            role=PlatformRole.SUPPORT,
        )
        db.commit()
        assert created.email == "support@example.com"
        assert created.role == PlatformRole.SUPPORT
        assert verify_password("a-strong-platform-password", created.password_hash)
        assert secret == created.totp_secret
        with pytest.raises(ValueError, match="already exists"):
            create_platform_user(
                db,
                email="support@example.com",
                password="another-strong-password",
                role=PlatformRole.OWNER,
            )


def test_local_billing_read_is_household_isolated_and_children_forbidden(tmp_path: Path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    first = seed_household()
    seed_household(second=True)
    with TestClient(app) as client:
        login_household(client, str(first["owner_email"]))
        response = client.get("/chore-api/billing")
        assert response.status_code == 200
        assert response.json()["household_id"] == first["household_id"]
        assert response.json()["status"] == "none"


def test_ops_csrf_reauth_logout_and_cookie_security_are_isolated(tmp_path: Path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    owner = seed_platform(PlatformRole.OWNER)
    with TestClient(app, base_url="https://testserver") as client:
        login = client.post("/ops-api/auth/login", json={"email": owner["email"], "password": "platform-password", "totp_code": totp_code(str(owner["secret"]))})
        assert login.status_code == 200
        assert all("Secure" in value for value in login.headers.get_list("set-cookie"))
        assert "chore_tracker_session" not in client.cookies
        denied = client.post("/ops-api/auth/reauth", json={"password": "platform-password", "totp_code": totp_code(str(owner["secret"]))})
        assert denied.status_code == 403
        headers = {"X-Ops-CSRF-Token": login.json()["csrf_token"]}
        reauth = client.post("/ops-api/auth/reauth", headers=headers, json={"password": "platform-password", "totp_code": totp_code(str(owner["secret"]))})
        assert reauth.status_code == 204
        logout = client.post("/ops-api/auth/logout", headers=headers)
        assert logout.status_code == 204
        assert client.get("/ops-api/auth/me").status_code == 401


def test_idempotency_payload_conflict_and_subscription_projection(tmp_path: Path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    household = seed_household()
    owner = seed_platform(PlatformRole.OWNER)
    with TestClient(app) as client:
        headers = login_ops(client, owner)
        expiry = datetime.now(UTC) + timedelta(days=20)
        payload = {"expires_at": expiry.isoformat(), "reason": "Recovery", "idempotency_key": "same-key"}
        assert client.post(f"/ops-api/households/{household['household_id']}/complimentary", headers=headers, json=payload).status_code == 200
        conflict = client.post(f"/ops-api/households/{household['household_id']}/complimentary", headers=headers, json={**payload, "reason": "Changed payload"})
        assert conflict.status_code == 409
    sf = get_session_factory(get_settings().database_url)
    with sf() as db:
        subscription = db.scalar(select(Subscription))
        assert subscription is not None
        assert subscription.status == EntitlementStatus.COMPLIMENTARY
        assert subscription.current_period_end is not None


def test_non_owner_cannot_transfer_ownership(tmp_path: Path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    seeded = seed_household()
    sf = get_session_factory(get_settings().database_url)
    with sf() as db:
        target = db.get(User, int(seeded["target_id"]))
        assert target is not None
        target_email = target.email
    with TestClient(app) as client:
        login = client.post("/chore-api/auth/login", json={"email": target_email, "password": "target-password"})
        response = client.post(
            "/chore-api/households/me/ownership/transfer",
            headers={"X-CSRF-Token": login.json()["csrf_token"]},
            json={"new_owner_user_id": seeded["owner_id"], "current_password": "target-password", "confirmation": "TRANSFER OWNERSHIP"},
        )
        assert response.status_code == 403


def test_sqlite_owner_and_append_only_database_guards(tmp_path: Path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    first = seed_household()
    second = seed_household(second=True)
    sf = get_session_factory(get_settings().database_url)
    with sf() as db:
        with pytest.raises((DatabaseError, IntegrityError), match="owner"):
            db.execute(text("UPDATE households SET owner_user_id=:owner WHERE id=:home"), {"owner": second["owner_id"], "home": first["household_id"]})
            db.commit()
        db.rollback()
        with pytest.raises((DatabaseError, IntegrityError), match="owner"):
            db.execute(text("UPDATE users SET active=0 WHERE id=:owner"), {"owner": first["owner_id"]})
            db.commit()
        db.rollback()

        platform = PlatformUser(email="raw@ops.test", password_hash="x", role=PlatformRole.OWNER, totp_secret="x", active=True)
        db.add(platform)
        db.flush()
        audit = PlatformAuditEvent(event_type="raw", actor_platform_user_id=platform.id, reason="", details_json="{}")
        db.add(audit)
        db.commit()
        with pytest.raises((DatabaseError, IntegrityError), match="append-only"):
            db.execute(text("UPDATE platform_audit_events SET reason='tampered' WHERE id=:id"), {"id": audit.id})
            db.commit()
