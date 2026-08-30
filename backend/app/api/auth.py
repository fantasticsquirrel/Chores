from __future__ import annotations

import asyncio
import ipaddress
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db_session
from app.config import get_settings
from app.models.core import Household, User
from app.schemas.auth import (
    AuthSessionResponse,
    AuthUserResponse,
    ChangePasswordRequest,
    ChildLoginRequest,
    LoginRequest,
    PasswordResetConfirmPayload,
    PasswordResetRequestPayload,
    PasswordResetResponse,
    RegistrationRequestPayload,
    RegistrationVerifyPayload,
)
from app.security import passwords as password_security
from app.security.audit import account_key_hash, audit, record_login_attempt, request_ip, retry_after_seconds
from app.security.csrf import CSRF_COOKIE_NAME, CSRF_HEADER_NAME, create_csrf_token, is_valid_csrf_token
from app.security.passwords import PASSWORD_MAX_LENGTH, PARENT_PASSWORD_MIN_LENGTH
from app.security.sessions import SESSION_COOKIE_NAME, create_session_token, resolve_session, revoke_session, revoke_user_sessions
from app.services.auth import AuthService
from app.services.password_resets import PasswordResetService
from app.services.registrations import RegistrationService

router = APIRouter(prefix="/auth", tags=["auth"])
_service = AuthService()

PASSWORD_RESET_REQUEST_ACK = "If an eligible account exists for that address, reset instructions will arrive shortly."
PASSWORD_RESET_CONFIRM_ACK = "Try signing in. If you cannot sign in, request a new reset link."
REGISTRATION_REQUEST_ACK = "Check your email for a verification link. If the address is already registered, sign in or reset your password."
REGISTRATION_VERIFY_ACK = "Verification processed. Try signing in; if it does not work, register again."


def _password_reset_service() -> PasswordResetService:
    return PasswordResetService(settings=get_settings())


@router.post("/registration/request", response_model=PasswordResetResponse, status_code=status.HTTP_202_ACCEPTED)
async def request_registration(payload: RegistrationRequestPayload, request: Request, session: Session = Depends(get_db_session)) -> PasswordResetResponse:
    started_at = time.perf_counter()
    try:
        RegistrationService(settings=get_settings()).request(
            session,
            email=payload.email,
            password=payload.password,
            household_name=payload.household_name,
            timezone=payload.timezone,
            ip_address=request_ip(request),
        )
        session.commit()
    except Exception:
        session.rollback()
    finally:
        await _password_reset_response_floor(started_at)
    return PasswordResetResponse(detail=REGISTRATION_REQUEST_ACK)


@router.post("/registration/verify", response_model=PasswordResetResponse, status_code=status.HTTP_202_ACCEPTED)
def verify_registration(payload: RegistrationVerifyPayload, session: Session = Depends(get_db_session)) -> PasswordResetResponse:
    token = payload.token if isinstance(payload.token, str) and len(payload.token) <= 1024 else ""
    try:
        user = RegistrationService(settings=get_settings()).verify(session, token=token)
        if user is not None:
            session.commit()
        else:
            session.rollback()
    except Exception:
        session.rollback()
    return PasswordResetResponse(detail=REGISTRATION_VERIFY_ACK)


async def _password_reset_response_floor(started_at: float) -> None:
    remaining = get_settings().password_reset_response_floor_ms / 1000 - (time.perf_counter() - started_at)
    if remaining > 0:
        await asyncio.sleep(remaining)


def _password_reset_confirmation_response_floor(started_at: float) -> None:
    remaining = get_settings().password_reset_response_floor_ms / 1000 - (time.perf_counter() - started_at)
    if remaining > 0:
        time.sleep(remaining)


def _build_session_response(user: User, session: Session, *, csrf_token: str | None = None) -> AuthSessionResponse:
    projected = AuthUserResponse.model_validate(user)
    household = session.get(Household, user.household_id)
    projected.is_household_owner = household is not None and household.owner_user_id == user.id
    return AuthSessionResponse(user=projected, csrf_token=csrf_token)


def _request_uses_https(request: Request) -> bool:
    if request.url.scheme == "https":
        return True
    peer = request.client.host if request.client is not None else ""
    try:
        trusted_proxy = ipaddress.ip_address(peer).is_loopback
    except ValueError:
        trusted_proxy = False
    if not trusted_proxy:
        return False
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    return forwarded_proto.split(",", 1)[0].strip().lower() == "https"


def _set_session_cookies(
    user: User,
    request: Request,
    response: Response,
    session: Session,
    *,
    expected_session_generation: int | None = None,
) -> str | None:
    settings = get_settings()
    token = create_session_token(
        session,
        user.id,
        max_age_seconds=settings.session_max_age_seconds,
        ip_address=request_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        expected_session_generation=expected_session_generation,
    )
    if token is None:
        return None
    csrf_token = create_csrf_token()
    secure_cookie = settings.session_cookie_secure or _request_uses_https(request)
    for key, value, httponly in ((SESSION_COOKIE_NAME, token, True), (CSRF_COOKIE_NAME, csrf_token, False)):
        response.set_cookie(key=key, value=value, httponly=httponly, samesite="lax", secure=secure_cookie, max_age=settings.session_max_age_seconds, path="/")
    return csrf_token


def _enforce_login_limit(session: Session, request: Request, key_hash: str) -> str:
    settings = get_settings()
    ip = request_ip(request)
    retry_after = retry_after_seconds(session, settings, key_hash, ip)
    if retry_after is not None:
        audit(session, "login.blocked", request=request, details={"account_key_hash": key_hash})
        session.commit()
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts. Try again later.", headers={"Retry-After": str(retry_after)})
    return ip


def _login_failed(session: Session, request: Request, key_hash: str, ip: str) -> None:
    record_login_attempt(session, key_hash, ip, succeeded=False)
    audit(session, "login.failure", request=request, details={"account_key_hash": key_hash})
    session.commit()


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, request: Request, response: Response, session: Session = Depends(get_db_session)) -> AuthSessionResponse:
    key_hash = account_key_hash("parent", payload.email)
    ip = _enforce_login_limit(session, request, key_hash)
    authenticated = _service.authenticate(session, payload.email, payload.password)
    if authenticated is None or not authenticated.user.active:
        _login_failed(session, request, key_hash, ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    user = authenticated.user
    record_login_attempt(session, key_hash, ip, succeeded=True)
    audit(session, "login.success", request=request, actor=user)
    csrf_token = _set_session_cookies(
        user,
        request,
        response,
        session,
        expected_session_generation=authenticated.session_generation,
    )
    if csrf_token is None:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    session.commit()
    return _build_session_response(user, session, csrf_token=csrf_token)


@router.post("/child-login", response_model=AuthSessionResponse)
def child_login(payload: ChildLoginRequest, request: Request, response: Response, session: Session = Depends(get_db_session)) -> AuthSessionResponse:
    key_hash = account_key_hash("child", payload.parent_email, payload.child_name)
    ip = _enforce_login_limit(session, request, key_hash)
    result = _service.authenticate_child(session, payload.parent_email, payload.child_name, payload.password)
    if result.user is None or not result.user.active:
        _login_failed(session, request, key_hash, ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid child login credentials.")
    record_login_attempt(session, key_hash, ip, succeeded=True)
    audit(session, "login.success", request=request, actor=result.user)
    csrf_token = _set_session_cookies(
        result.user,
        request,
        response,
        session,
        expected_session_generation=result.session_generation,
    )
    if csrf_token is None:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid child login credentials.")
    session.commit()
    return _build_session_response(result.user, session, csrf_token=csrf_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, session: Session = Depends(get_db_session)) -> Response:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    auth_session = resolve_session(session, token) if token else None
    actor = session.get(User, auth_session.user_id) if auth_session else None
    if token:
        revoke_session(session, token)
    audit(session, "session.logout", request=request, actor=actor)
    session.commit()
    response.status_code = status.HTTP_204_NO_CONTENT
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")
    return response


@router.get("/me", response_model=AuthSessionResponse)
def get_current_session(request: Request, session: Session = Depends(get_db_session), user: User = Depends(get_current_user)) -> AuthSessionResponse:
    return _build_session_response(user, session, csrf_token=request.cookies.get(CSRF_COOKIE_NAME))


@router.post("/password-reset/request", response_model=PasswordResetResponse, status_code=status.HTTP_202_ACCEPTED)
async def request_password_reset(
    payload: PasswordResetRequestPayload,
    request: Request,
    session: Session = Depends(get_db_session),
) -> PasswordResetResponse:
    """Always acknowledge public recovery requests without an account oracle."""
    started_at = time.perf_counter()
    service = _password_reset_service()
    try:
        service.request_password_reset(
            session,
            email=payload.email if isinstance(payload.email, str) and len(payload.email) <= 320 else "",
            ip_address=request_ip(request),
        )
        session.commit()
    except Exception:
        session.rollback()
        # Preserve the public acknowledgement if transient persistence has an
        # error; event logging contains path/status only and never payload data.
    finally:
        await _password_reset_response_floor(started_at)
    return PasswordResetResponse(detail=PASSWORD_RESET_REQUEST_ACK)


def _password_reset_confirmation_payload(payload: PasswordResetConfirmPayload) -> tuple[str, str]:
    """Bound malformed confirmation input before it reaches hashing or Argon2.

    The caller deliberately returns the same acknowledgement for every outcome;
    this helper only prevents pathological request-body values from consuming
    disproportionate CPU before the uniform public response is sent.
    """
    token = payload.token if isinstance(payload.token, str) and len(payload.token) <= 1024 else ""
    new_password = (
        payload.new_password
        if isinstance(payload.new_password, str)
        and PARENT_PASSWORD_MIN_LENGTH <= len(payload.new_password) <= PASSWORD_MAX_LENGTH
        else ""
    )
    return token, new_password


def _may_complete_password_reset(request: Request, session: Session) -> bool:
    """Apply CSRF/origin protection without creating a completion oracle.

    Cookie-less and stale-cookie recovery remain capability-authorized. A live
    session, however, must supply the canonical Origin and double-submit CSRF
    pair before its browser can mutate a credential. The caller deliberately
    returns the same public 202 acknowledgement in either case.
    """
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if session_token is None or resolve_session(session, session_token) is None:
        return True

    return request.headers.get("origin") == "https://family.multihost.ing" and is_valid_csrf_token(
        request.cookies.get(CSRF_COOKIE_NAME),
        request.headers.get(CSRF_HEADER_NAME),
    )


@router.post("/password-reset/confirm", response_model=PasswordResetResponse, status_code=status.HTTP_202_ACCEPTED)
def confirm_password_reset(
    payload: PasswordResetConfirmPayload,
    request: Request,
    response: Response,
    session: Session = Depends(get_db_session),
) -> PasswordResetResponse:
    """Consume one opaque capability, revoke sessions, and never auto-login."""
    started_at = time.perf_counter()
    completed = False
    # This non-blocking admission boundary caps both an invalid request's timing
    # pad and a valid request's password hash. When saturated, do not inspect
    # the capability or mutate state: every caller receives the same public
    # floor and acknowledgement, and a legitimate user may safely retry later.
    admitted = password_security.acquire_password_reset_confirmation_budget()
    if admitted:
        try:
            if _may_complete_password_reset(request, session) and get_settings().password_reset_enabled:
                token, new_password = _password_reset_confirmation_payload(payload)
                user = _password_reset_service().consume_password_reset(
                    session,
                    token=token,
                    new_password=new_password,
                )
                if user is not None:
                    revoke_user_sessions(session, user.id)
                    audit(session, "credential.password_reset", request=request, actor=user, target=user)
                    session.commit()
                    completed = True
                else:
                    session.rollback()
                    password_security.burn_password_reset_confirmation_timing_budget()
            else:
                password_security.burn_password_reset_confirmation_timing_budget()
        except Exception:
            session.rollback()
            # Preserve the public acknowledgement even if optional equalization
            # work has a transient internal failure.
            try:
                password_security.burn_password_reset_confirmation_timing_budget()
            except Exception:
                pass
        finally:
            password_security.release_password_reset_confirmation_budget()
    # Do not turn a rejected CSRF attempt or an invalid capability into a logout
    # primitive. Only an authoritative completed reset clears active browser
    # cookies; every response still has the same public 202 acknowledgement.
    if completed:
        response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
        response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")
    _password_reset_confirmation_response_floor(started_at)
    return PasswordResetResponse(detail=PASSWORD_RESET_CONFIRM_ACK)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> Response:
    if not _service.change_password(session=session, user=user, current_password=payload.current_password, new_password=payload.new_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    _password_reset_service().invalidate_active_resets(session, user_id=user.id)
    revoke_user_sessions(session, user.id)
    audit(session, "credential.password_changed", request=request, actor=user, target=user)
    session.commit()
    response.status_code = status.HTTP_204_NO_CONTENT
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")
    return response
