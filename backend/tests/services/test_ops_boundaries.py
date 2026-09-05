from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.models.enums import EntitlementStatus, PlatformRole, UserRole
from app.models.identity import Household, User
from app.models.platform import PlatformSession, PlatformUser, SupportCase
from app.security.passwords import hash_password
from app.security.totp import generate_totp_secret, totp_code
from app.security.totp_crypto import encrypt_totp_secret
from app.services.ops import audit, billing_reconciliation, platform_users, support_cases

TEST_TOTP_KEY = "v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="


def _configure(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'ops-services.db'}")
    monkeypatch.setenv("SECRET_KEY", "z" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("PLATFORM_TOTP_ENCRYPTION_KEYS", TEST_TOTP_KEY)
    monkeypatch.setenv("PLATFORM_TOTP_ACTIVE_KEY_VERSION", "v1")
    get_settings.cache_clear()
    settings = get_settings()
    initialize_database(settings)
    return get_session_factory(settings.database_url)


def _seed_ops_data(session_factory) -> dict[str, object]:
    secret = generate_totp_secret()
    with session_factory() as session:
        household = Household(name="Smith Family", timezone="UTC")
        other_household = Household(name="Other Family", timezone="UTC")
        session.add_all([household, other_household])
        session.flush()
        owner = User(
            household_id=household.id,
            email="owner.smith@example.com",
            password_hash="hash",
            role=UserRole.PARENT_ADMIN,
            active=True,
        )
        operator = PlatformUser(
            email="platform@example.com",
            password_hash=hash_password("platform-password"),
            role=PlatformRole.OWNER,
            totp_secret_ciphertext=encrypt_totp_secret(secret),
            totp_key_version="v1",
            active=True,
        )
        session.add_all([owner, operator])
        session.flush()
        household.owner_user_id = owner.id
        support_case = SupportCase(
            household_id=household.id,
            opened_by_platform_user_id=operator.id,
            reason="Review projection",
            status="open",
        )
        other_case = SupportCase(
            household_id=other_household.id,
            opened_by_platform_user_id=operator.id,
            reason="Other account",
            status="open",
        )
        session.add_all([support_case, other_case])
        session.commit()
        return {
            "household_id": household.id,
            "other_household_id": other_household.id,
            "operator_id": operator.id,
            "support_case_id": support_case.id,
            "other_case_id": other_case.id,
            "secret": secret,
        }


def test_platform_user_service_authenticates_and_mutates_session_without_committing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_factory = _configure(tmp_path, monkeypatch)
    seeded = _seed_ops_data(session_factory)

    with session_factory() as session:
        commit = Mock(side_effect=AssertionError("service must not commit"))
        session.commit = commit
        user = platform_users.authenticate_platform_user(
            session,
            email="PLATFORM@EXAMPLE.COM",
            password="platform-password",
            totp_code=totp_code(str(seeded["secret"])),
        )
        assert user is not None
        assert platform_users.platform_user_dict(user) == {
            "id": seeded["operator_id"],
            "email": "platform@example.com",
            "role": "PLATFORM_OWNER",
            "mfa_required": True,
            "mfa_verified": True,
        }
        assert platform_users.authenticate_platform_user(
            session,
            email="platform@example.com",
            password="wrong-password",
            totp_code=totp_code(str(seeded["secret"])),
        ) is None

        now = datetime(2026, 9, 5, 12, tzinfo=UTC)
        auth_session = PlatformSession(
            platform_user_id=user.id,
            token_hash="a" * 64,
            expires_at=now + timedelta(hours=8),
            mfa_verified_at=now - timedelta(minutes=5),
            recent_reauth_at=now - timedelta(minutes=5),
        )
        platform_users.mark_platform_session_reauthenticated(auth_session, at=now)
        platform_users.revoke_platform_session(auth_session, at=now + timedelta(minutes=1))
        assert auth_session.recent_reauth_at == now
        assert auth_session.revoked_at == now + timedelta(minutes=1)
        commit.assert_not_called()


def test_support_case_and_audit_services_append_and_serialize_without_committing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_factory = _configure(tmp_path, monkeypatch)
    seeded = _seed_ops_data(session_factory)

    with session_factory() as session:
        commit = Mock(side_effect=AssertionError("service must not commit"))
        session.commit = commit
        case = support_cases.create_support_case(
            session,
            household_id=int(seeded["household_id"]),
            opened_by_platform_user_id=int(seeded["operator_id"]),
            reason="Customer requested help",
        )
        audit.record_platform_audit(
            session,
            "support.case_opened",
            actor_platform_user_id=int(seeded["operator_id"]),
            household_id=int(seeded["household_id"]),
            reason=case.reason,
            details={"case_id": case.id},
        )
        _, note = support_cases.add_support_case_note(
            session,
            case_id=case.id,
            author_platform_user_id=int(seeded["operator_id"]),
            body="Verified local state.",
        )
        session.flush()

        case_payload = support_cases.support_case_dict(session, case)
        assert case_payload["household_id"] == seeded["household_id"]
        assert case_payload["subject"] == "Customer requested help"
        assert case_payload["notes"] == [
            {
                "id": note.id,
                "case_id": case.id,
                "author_email": "p***@example.com",
                "body": "Verified local state.",
                "created_at": note.created_at,
            }
        ]
        audit_payloads = audit.list_household_audit_events(
            session,
            int(seeded["household_id"]),
        )
        assert audit_payloads[0]["actor_email"] == "p***@example.com"
        assert audit_payloads[0]["action"] == "support.case_opened"
        commit.assert_not_called()


def test_support_case_service_preserves_not_found_contract(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_factory = _configure(tmp_path, monkeypatch)
    _seed_ops_data(session_factory)

    with session_factory() as session, pytest.raises(HTTPException) as exc_info:
        support_cases.create_support_case(
            session,
            household_id=999_999,
            opened_by_platform_user_id=1,
            reason="Missing household",
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Household not found."


def test_billing_reconciliation_service_is_case_scoped_and_leaves_commit_to_router(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_factory = _configure(tmp_path, monkeypatch)
    seeded = _seed_ops_data(session_factory)
    household_id = int(seeded["household_id"])

    with session_factory() as session:
        commit = Mock(side_effect=AssertionError("service must not commit"))
        session.commit = commit
        with pytest.raises(HTTPException) as exc_info:
            billing_reconciliation.reconcile_household_billing(
                session,
                household_id=household_id,
                case_id=int(seeded["other_case_id"]),
            )
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == "An open support case for this household is required."

        now = datetime(2026, 9, 5, 12, tzinfo=UTC)
        with pytest.raises(HTTPException) as expiry_error:
            billing_reconciliation.grant_complimentary_entitlement(
                session,
                household_id=household_id,
                expires_at=now,
                reason="Expired grant",
                idempotency_key="expired-service-boundary-grant",
                now=now,
            )
        assert expiry_error.value.status_code == 422
        assert expiry_error.value.detail == "Complimentary expiry must be finite and in the future."

        grant = billing_reconciliation.grant_complimentary_entitlement(
            session,
            household_id=household_id,
            expires_at=now + timedelta(days=30),
            reason="Service recovery",
            idempotency_key="service-boundary-grant",
            now=now,
        )
        assert grant.entitlement.status == EntitlementStatus.COMPLIMENTARY
        reconciliation = billing_reconciliation.reconcile_household_billing(
            session,
            household_id=household_id,
            case_id=int(seeded["support_case_id"]),
        )
        assert reconciliation.entitlement.projected_event_id == grant.event.id

        search_results = billing_reconciliation.search_households(session, "OWNER.SMITH")
        assert search_results == [
            {
                "id": household_id,
                "name": "Smith Family",
                "owner_email": "o***@example.com",
                "billing_status": "complimentary",
            }
        ]
        detail = billing_reconciliation.household_detail(session, household_id)
        assert detail["billing"]["status"] == "complimentary"
        assert "household_id" not in detail["support_cases"][0]
        assert billing_reconciliation.list_household_billing_events(
            session,
            household_id,
        )[0]["id"] == str(grant.event.id)
        assert billing_reconciliation.household_billing_detail(
            session,
            household_id,
        )["events"][0]["id"] == grant.event.id
        commit.assert_not_called()
