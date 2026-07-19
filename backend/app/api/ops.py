from __future__ import annotations

from datetime import UTC, datetime, timedelta
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import String, cast, or_, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session
from app.api.ops_dependencies import PlatformPrincipal, get_platform_principal, require_platform_roles
from app.models.billing import BillingEvent, HouseholdEntitlement
from app.models.core import Household, User
from app.models.enums import EntitlementStatus, PlatformRole
from app.models.platform import PlatformAuditEvent, PlatformSession, PlatformUser, SupportCase, SupportCaseNote
from app.config import get_settings
from app.schemas.platform import ComplimentaryRequest, OpsLoginRequest, OpsReauthRequest, ReconcileRequest, SupportCaseCreate, SupportNoteCreate
from app.security.passwords import verify_password
from app.security.platform_sessions import OPS_CSRF_COOKIE_NAME, OPS_SESSION_COOKIE_NAME, create_platform_session, has_recent_reauth
from app.security.totp import verify_totp
from app.security.totp_crypto import decrypt_totp_secret
from app.security.audit import account_key_hash, record_login_attempt, request_ip, retry_after_seconds
from app.services.billing import apply_event, entitlement_for_household

router = APIRouter(tags=["platform-operations"])


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _audit(db: Session, principal: PlatformPrincipal, event_type: str, *, household_id: int | None = None, reason: str = "", details: dict[str, object] | None = None) -> None:
    db.add(PlatformAuditEvent(event_type=event_type, actor_platform_user_id=principal.user.id, household_id=household_id, reason=reason, details_json=json.dumps(details or {}, sort_keys=True)))


def _redact_email(email: str) -> str:
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"


def _platform_email(db: Session, platform_user_id: int) -> str:
    operator = db.get(PlatformUser, platform_user_id)
    return _redact_email(operator.email) if operator is not None else "***"


def _billing_status(entitlement: HouseholdEntitlement) -> dict[str, object]:
    return {
        "status": entitlement.status.value,
        "provider": None,
        "plan_name": "Family Plus" if entitlement.status != EntitlementStatus.NONE else None,
        "expires_at": entitlement.valid_until,
        "current_period_ends_at": None,
        "available_actions": [],
    }


def _household_detail(db: Session, household: Household) -> dict[str, object]:
    owner = db.get(User, household.owner_user_id) if household.owner_user_id else None
    owner_email = _redact_email(owner.email) if owner else "***"
    entitlement = entitlement_for_household(db, household.id)
    cases = db.scalars(
        select(SupportCase)
        .where(SupportCase.household_id == household.id)
        .order_by(SupportCase.id.desc())
    ).all()
    support_cases: list[dict[str, object]] = []
    for case in cases:
        notes = db.scalars(
            select(SupportCaseNote)
            .where(SupportCaseNote.case_id == case.id)
            .order_by(SupportCaseNote.id)
        ).all()
        support_cases.append(
            {
                "id": case.id,
                "subject": case.reason,
                "status": case.status,
                "created_at": case.created_at,
                "notes": [
                    {
                        "id": note.id,
                        "author_email": _platform_email(
                            db, note.author_platform_user_id
                        ),
                        "body": note.body,
                        "created_at": note.created_at,
                    }
                    for note in notes
                ],
            }
        )
    return {
        "id": household.id,
        "name": household.name,
        "owner_email": owner_email,
        "billing_status": entitlement.status.value,
        "ownership": {
            "household_id": household.id,
            "owner_user_id": household.owner_user_id,
            "owner_email": owner_email,
        },
        "billing": _billing_status(entitlement),
        "entitlements": [
            {
                "key": entitlement.plan_key,
                "status": entitlement.status.value,
                "expires_at": entitlement.valid_until,
            }
        ],
        "support_cases": support_cases,
    }


@router.post("/auth/login")
def login(payload: OpsLoginRequest, request: Request, response: Response, db: Session = Depends(get_db_session)) -> dict[str, object]:
    settings = get_settings()
    key_hash = account_key_hash("platform", payload.email)
    ip = request_ip(request)
    retry_after = retry_after_seconds(db, settings, key_hash, ip)
    if retry_after is not None:
        db.commit()
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.", headers={"Retry-After": str(retry_after)})
    user = db.scalar(select(PlatformUser).where(PlatformUser.email == payload.email.lower()))
    valid = user is not None and user.active and verify_password(payload.password, user.password_hash)
    if valid:
        valid = verify_totp(decrypt_totp_secret(user.totp_secret_ciphertext, user.totp_key_version), payload.totp_code)
    if not valid:
        record_login_attempt(db, key_hash, ip, succeeded=False)
        db.add(PlatformAuditEvent(event_type="platform.login_failure", actor_platform_user_id=None, household_id=None, reason="", details_json=json.dumps({"account_key_hash": key_hash})))
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid platform credentials or MFA code.")
    record_login_attempt(db, key_hash, ip, succeeded=True)
    token, csrf, auth_session = create_platform_session(db, user.id)
    principal = PlatformPrincipal(user=user, auth_session=auth_session, csrf_token=csrf)
    _audit(db, principal, "platform.login")
    db.commit()
    secure = get_settings().session_cookie_secure or request.url.scheme == "https"
    response.set_cookie(OPS_SESSION_COOKIE_NAME, token, httponly=True, secure=secure, samesite="strict", max_age=8 * 3600, path="/ops-api")
    response.set_cookie(OPS_CSRF_COOKIE_NAME, csrf, httponly=False, secure=secure, samesite="strict", max_age=8 * 3600, path="/ops-api")
    return {"user": {"id": user.id, "email": user.email, "role": user.role.value, "mfa_required": True, "mfa_verified": True}, "csrf_token": csrf}


@router.get("/auth/me")
def me(principal: PlatformPrincipal = Depends(get_platform_principal)) -> dict[str, object]:
    return {"user": {"id": principal.user.id, "email": principal.user.email, "role": principal.user.role.value, "mfa_required": True, "mfa_verified": True}, "recent_reauth": has_recent_reauth(principal.auth_session), "csrf_token": principal.csrf_token}


@router.post("/auth/reauth", status_code=status.HTTP_204_NO_CONTENT)
def reauth(payload: OpsReauthRequest, db: Session = Depends(get_db_session), principal: PlatformPrincipal = Depends(get_platform_principal)) -> Response:
    if not verify_password(payload.password, principal.user.password_hash) or not verify_totp(principal.user.totp_secret, payload.totp_code):
        raise HTTPException(status_code=401, detail="Invalid platform credentials or MFA code.")
    principal.auth_session.recent_reauth_at = datetime.now(UTC)
    _audit(db, principal, "platform.reauthenticated")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, db: Session = Depends(get_db_session), principal: PlatformPrincipal = Depends(get_platform_principal)) -> Response:
    principal.auth_session.revoked_at = datetime.now(UTC)
    _audit(db, principal, "platform.logout")
    db.commit()
    response.status_code = status.HTTP_204_NO_CONTENT
    response.delete_cookie(OPS_SESSION_COOKIE_NAME, path="/ops-api")
    response.delete_cookie(OPS_CSRF_COOKIE_NAME, path="/ops-api")
    return response


@router.get("/households")
def search_households(query: str = Query(min_length=1, max_length=200), db: Session = Depends(get_db_session), _: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT))) -> list[dict[str, object]]:
    normalized = query.strip().lower()
    homes = db.scalars(select(Household).outerjoin(User, User.id == Household.owner_user_id).where(or_(Household.name.ilike(f"%{normalized}%"), User.email.ilike(f"%{normalized}%"), cast(Household.id, String) == normalized)).order_by(Household.id).limit(50)).all()
    result = []
    for home in homes:
        owner = db.get(User, home.owner_user_id) if home.owner_user_id else None
        entitlement = entitlement_for_household(db, home.id)
        result.append({"id": home.id, "name": home.name, "owner_email": _redact_email(owner.email) if owner else "***", "billing_status": entitlement.status.value})
    db.commit()
    return result


@router.get("/households/{household_id}")
def view_household(
    household_id: int,
    db: Session = Depends(get_db_session),
    _: PlatformPrincipal = Depends(
        require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT)
    ),
) -> dict[str, object]:
    household = db.get(Household, household_id)
    if household is None:
        raise HTTPException(status_code=404, detail="Household not found.")
    detail = _household_detail(db, household)
    db.commit()
    return detail


@router.get("/households/{household_id}/events")
def list_household_events(
    household_id: int,
    db: Session = Depends(get_db_session),
    _: PlatformPrincipal = Depends(
        require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT)
    ),
) -> list[dict[str, object]]:
    events = db.scalars(
        select(BillingEvent)
        .where(BillingEvent.household_id == household_id)
        .order_by(BillingEvent.id.desc())
        .limit(100)
    ).all()
    return [
        {
            "id": str(event.id),
            "type": event.event_type,
            "occurred_at": event.occurred_at,
            "summary": event.event_type.replace(".", " "),
        }
        for event in events
    ]


@router.get("/households/{household_id}/audit")
def list_household_audit(
    household_id: int,
    db: Session = Depends(get_db_session),
    _: PlatformPrincipal = Depends(
        require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT)
    ),
) -> list[dict[str, object]]:
    events = db.scalars(
        select(PlatformAuditEvent)
        .where(PlatformAuditEvent.household_id == household_id)
        .order_by(PlatformAuditEvent.id.desc())
        .limit(100)
    ).all()
    return [
        {
            "id": str(event.id),
            "actor_email": (
                _platform_email(db, event.actor_platform_user_id)
                if event.actor_platform_user_id is not None
                else "system"
            ),
            "action": event.event_type,
            "occurred_at": event.created_at,
            "reason": event.reason or None,
        }
        for event in events
    ]


@router.get("/households/{household_id}/billing")
def view_household_billing(household_id: int, db: Session = Depends(get_db_session), _: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT))) -> dict[str, object]:
    if db.get(Household, household_id) is None:
        raise HTTPException(status_code=404, detail="Household not found.")
    entitlement = entitlement_for_household(db, household_id)
    events = db.scalars(select(BillingEvent).where(BillingEvent.household_id == household_id).order_by(BillingEvent.id.desc()).limit(100)).all()
    db.commit()
    return {"household_id": household_id, "entitlement": {"plan_key": entitlement.plan_key, "status": entitlement.status.value, "valid_until": entitlement.valid_until}, "events": [{"id": row.id, "source": row.source, "event_type": row.event_type, "occurred_at": row.occurred_at} for row in events]}


@router.post("/households/{household_id}/complimentary")
def grant_complimentary(household_id: int, payload: ComplimentaryRequest, db: Session = Depends(get_db_session), principal: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER))) -> dict[str, object]:
    if not has_recent_reauth(principal.auth_session):
        raise HTTPException(status_code=403, detail="Recent reauthentication required.")
    household = db.get(Household, household_id)
    if household is None:
        raise HTTPException(status_code=404, detail="Household not found.")
    expiry = _aware(payload.expires_at)
    now = datetime.now(UTC)
    if expiry <= now or expiry > now + timedelta(days=3660):
        raise HTTPException(status_code=422, detail="Complimentary expiry must be finite and in the future.")
    event_payload = {"expires_at": expiry.isoformat(), "reason": payload.reason, "plan_key": "family_plus"}
    try:
        event, entitlement, replay = apply_event(db, household_id=household_id, source="platform", idempotency_key=payload.idempotency_key, event_type="complimentary.granted", occurred_at=now, status=EntitlementStatus.COMPLIMENTARY, valid_until=expiry, payload=event_payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not replay:
        _audit(db, principal, "complimentary.granted", household_id=household_id, reason=payload.reason, details={"billing_event_id": event.id, "expires_at": expiry.isoformat()})
    db.commit()
    detail = _household_detail(db, household)
    detail.update(
        {
            "event_id": event.id,
            "household_id": household_id,
            "status": entitlement.status.value,
            "expires_at": entitlement.valid_until,
        }
    )
    return detail


@router.post("/support/cases", status_code=status.HTTP_201_CREATED)
def create_case(payload: SupportCaseCreate, db: Session = Depends(get_db_session), principal: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT))) -> dict[str, object]:
    if db.get(Household, payload.household_id) is None:
        raise HTTPException(status_code=404, detail="Household not found.")
    case = SupportCase(household_id=payload.household_id, opened_by_platform_user_id=principal.user.id, reason=payload.reason, status="open")
    db.add(case)
    db.flush()
    _audit(db, principal, "support.case_opened", household_id=payload.household_id, reason=payload.reason, details={"case_id": case.id})
    db.commit()
    return {
        "id": case.id,
        "household_id": case.household_id,
        "subject": case.reason,
        "status": case.status,
        "created_at": case.created_at,
        "notes": [],
    }


@router.post("/support/cases/{case_id}/notes", status_code=status.HTTP_201_CREATED)
def add_note(case_id: int, payload: SupportNoteCreate, db: Session = Depends(get_db_session), principal: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT))) -> dict[str, object]:
    case = db.get(SupportCase, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Support case not found.")
    note = SupportCaseNote(case_id=case.id, author_platform_user_id=principal.user.id, body=payload.body)
    db.add(note)
    db.flush()
    _audit(db, principal, "support.note_added", household_id=case.household_id, reason="case note", details={"case_id": case.id, "note_id": note.id})
    db.commit()
    return {
        "id": note.id,
        "case_id": case.id,
        "author_email": _platform_email(db, principal.user.id),
        "body": note.body,
        "created_at": note.created_at,
    }


@router.post("/households/{household_id}/reconcile")
def reconcile(household_id: int, payload: ReconcileRequest, db: Session = Depends(get_db_session), principal: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT))) -> dict[str, object]:
    case = db.get(SupportCase, payload.case_id)
    if case is None or case.household_id != household_id or case.status != "open":
        raise HTTPException(status_code=403, detail="An open support case for this household is required.")
    household = db.get(Household, household_id)
    if household is None:
        raise HTTPException(status_code=404, detail="Household not found.")
    entitlement = entitlement_for_household(db, household_id)
    _audit(db, principal, "billing.reconciled", household_id=household_id, reason=payload.reason, details={"case_id": case.id, "projected_event_id": entitlement.projected_event_id})
    db.commit()
    detail = _household_detail(db, household)
    detail["projected_event_id"] = entitlement.projected_event_id
    return detail
