from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session
from app.api.ops_dependencies import PlatformPrincipal, get_platform_principal, require_platform_roles
from app.config import get_settings
from app.models.enums import PlatformRole
from app.schemas.platform import ComplimentaryRequest, OpsLoginRequest, OpsReauthRequest, ReconcileRequest, SupportCaseCreate, SupportNoteCreate
from app.security.audit import account_key_hash, record_login_attempt, request_ip, retry_after_seconds
from app.security.platform_sessions import OPS_CSRF_COOKIE_NAME, OPS_SESSION_COOKIE_NAME, create_platform_session, has_recent_reauth
from app.services.ops import audit, billing_reconciliation, platform_users, support_cases

router = APIRouter(tags=["platform-operations"])


@router.post("/auth/login")
def login(
    payload: OpsLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db_session),
) -> dict[str, object]:
    settings = get_settings()
    key_hash = account_key_hash("platform", payload.email)
    ip = request_ip(request)
    retry_after = retry_after_seconds(db, settings, key_hash, ip)
    if retry_after is not None:
        db.commit()
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts. Try again later.", headers={"Retry-After": str(retry_after)})
    user = platform_users.authenticate_platform_user(
        db,
        email=payload.email,
        password=payload.password,
        totp_code=payload.totp_code,
    )
    if user is None:
        record_login_attempt(db, key_hash, ip, succeeded=False)
        audit.record_platform_audit(
            db,
            "platform.login_failure",
            actor_platform_user_id=None,
            details={"account_key_hash": key_hash},
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid platform credentials or MFA code.")
    record_login_attempt(db, key_hash, ip, succeeded=True)
    token, csrf, _auth_session = create_platform_session(db, user.id)
    audit.record_platform_audit(
        db,
        "platform.login",
        actor_platform_user_id=user.id,
    )
    db.commit()
    secure = settings.session_cookie_secure or request.url.scheme == "https"
    response.set_cookie(OPS_SESSION_COOKIE_NAME, token, httponly=True, secure=secure, samesite="strict", max_age=8 * 3600, path="/ops-api")
    response.set_cookie(OPS_CSRF_COOKIE_NAME, csrf, httponly=False, secure=secure, samesite="strict", max_age=8 * 3600, path="/ops-api")
    return {"user": platform_users.platform_user_dict(user), "csrf_token": csrf}


@router.get("/auth/me")
def me(
    principal: PlatformPrincipal = Depends(get_platform_principal),
) -> dict[str, object]:
    return {
        "user": platform_users.platform_user_dict(principal.user),
        "recent_reauth": has_recent_reauth(principal.auth_session),
        "csrf_token": principal.csrf_token,
    }


@router.post("/auth/reauth", status_code=status.HTTP_204_NO_CONTENT)
def reauth(
    payload: OpsReauthRequest,
    db: Session = Depends(get_db_session),
    principal: PlatformPrincipal = Depends(get_platform_principal),
) -> Response:
    if not platform_users.platform_user_credentials_are_valid(
        principal.user,
        payload.password,
        payload.totp_code,
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid platform credentials or MFA code.")
    platform_users.mark_platform_session_reauthenticated(principal.auth_session)
    audit.record_platform_audit(
        db,
        "platform.reauthenticated",
        actor_platform_user_id=principal.user.id,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: Session = Depends(get_db_session),
    principal: PlatformPrincipal = Depends(get_platform_principal),
) -> Response:
    platform_users.revoke_platform_session(principal.auth_session)
    audit.record_platform_audit(
        db,
        "platform.logout",
        actor_platform_user_id=principal.user.id,
    )
    db.commit()
    response.status_code = status.HTTP_204_NO_CONTENT
    response.delete_cookie(OPS_SESSION_COOKIE_NAME, path="/ops-api")
    response.delete_cookie(OPS_CSRF_COOKIE_NAME, path="/ops-api")
    return response


@router.get("/households")
def search_households(
    query: str = Query(min_length=1, max_length=200),
    db: Session = Depends(get_db_session),
    _: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT)),
) -> list[dict[str, object]]:
    result = billing_reconciliation.search_households(db, query)
    db.commit()
    return result


@router.get("/households/{household_id}")
def view_household(
    household_id: int,
    db: Session = Depends(get_db_session),
    _: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT)),
) -> dict[str, object]:
    detail = billing_reconciliation.household_detail(db, household_id)
    db.commit()
    return detail


@router.get("/households/{household_id}/events")
def list_household_events(
    household_id: int,
    db: Session = Depends(get_db_session),
    _: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT)),
) -> list[dict[str, object]]:
    return billing_reconciliation.list_household_billing_events(db, household_id)


@router.get("/households/{household_id}/audit")
def list_household_audit(
    household_id: int,
    db: Session = Depends(get_db_session),
    _: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT)),
) -> list[dict[str, object]]:
    return audit.list_household_audit_events(db, household_id)


@router.get("/households/{household_id}/billing")
def view_household_billing(
    household_id: int,
    db: Session = Depends(get_db_session),
    _: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT)),
) -> dict[str, object]:
    detail = billing_reconciliation.household_billing_detail(db, household_id)
    db.commit()
    return detail


@router.post("/households/{household_id}/complimentary")
def grant_complimentary(
    household_id: int,
    payload: ComplimentaryRequest,
    db: Session = Depends(get_db_session),
    principal: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER)),
) -> dict[str, object]:
    if not has_recent_reauth(principal.auth_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recent reauthentication required.",
        )
    try:
        grant = billing_reconciliation.grant_complimentary_entitlement(
            db,
            household_id=household_id,
            expires_at=payload.expires_at,
            reason=payload.reason,
            idempotency_key=payload.idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if not grant.replay:
        audit.record_platform_audit(
            db,
            "complimentary.granted",
            actor_platform_user_id=principal.user.id,
            household_id=household_id,
            reason=payload.reason,
            details={
                "billing_event_id": grant.event.id,
                "expires_at": grant.expires_at.isoformat(),
            },
        )
    db.commit()
    detail = billing_reconciliation.household_detail(db, household_id)
    detail.update(
        {
            "event_id": grant.event.id,
            "household_id": household_id,
            "status": grant.entitlement.status.value,
            "expires_at": grant.entitlement.valid_until,
        }
    )
    return detail


@router.post("/support/cases", status_code=status.HTTP_201_CREATED)
def create_case(
    payload: SupportCaseCreate,
    db: Session = Depends(get_db_session),
    principal: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT)),
) -> dict[str, object]:
    case = support_cases.create_support_case(
        db,
        household_id=payload.household_id,
        opened_by_platform_user_id=principal.user.id,
        reason=payload.reason,
    )
    audit.record_platform_audit(
        db,
        "support.case_opened",
        actor_platform_user_id=principal.user.id,
        household_id=payload.household_id,
        reason=payload.reason,
        details={"case_id": case.id},
    )
    db.commit()
    return support_cases.support_case_dict(db, case, notes=[])


@router.post("/support/cases/{case_id}/notes", status_code=status.HTTP_201_CREATED)
def add_note(
    case_id: int,
    payload: SupportNoteCreate,
    db: Session = Depends(get_db_session),
    principal: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT)),
) -> dict[str, object]:
    case, note = support_cases.add_support_case_note(
        db,
        case_id=case_id,
        author_platform_user_id=principal.user.id,
        body=payload.body,
    )
    audit.record_platform_audit(
        db,
        "support.note_added",
        actor_platform_user_id=principal.user.id,
        household_id=case.household_id,
        reason="case note",
        details={"case_id": case.id, "note_id": note.id},
    )
    db.commit()
    return support_cases.support_case_note_dict(db, note)


@router.post("/households/{household_id}/reconcile")
def reconcile(
    household_id: int,
    payload: ReconcileRequest,
    db: Session = Depends(get_db_session),
    principal: PlatformPrincipal = Depends(require_platform_roles(PlatformRole.OWNER, PlatformRole.SUPPORT)),
) -> dict[str, object]:
    reconciliation = billing_reconciliation.reconcile_household_billing(
        db,
        household_id=household_id,
        case_id=payload.case_id,
    )
    audit.record_platform_audit(
        db,
        "billing.reconciled",
        actor_platform_user_id=principal.user.id,
        household_id=household_id,
        reason=payload.reason,
        details={
            "case_id": reconciliation.case.id,
            "projected_event_id": reconciliation.entitlement.projected_event_id,
        },
    )
    db.commit()
    detail = billing_reconciliation.household_detail(db, household_id)
    detail["projected_event_id"] = reconciliation.entitlement.projected_event_id
    return detail
