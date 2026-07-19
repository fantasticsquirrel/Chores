from __future__ import annotations

import ipaddress

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db_session
from app.config import get_settings
from app.models.core import Household, User
from app.schemas.auth import AuthSessionResponse, AuthUserResponse, ChangePasswordRequest, ChildLoginRequest, LoginRequest
from app.security.audit import account_key_hash, audit, record_login_attempt, request_ip, retry_after_seconds
from app.security.csrf import CSRF_COOKIE_NAME, create_csrf_token
from app.security.sessions import SESSION_COOKIE_NAME, create_session_token, resolve_session, revoke_session, revoke_user_sessions
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
_service = AuthService()


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


def _set_session_cookies(user: User, request: Request, response: Response, session: Session) -> str:
    settings = get_settings()
    token = create_session_token(
        session,
        user.id,
        max_age_seconds=settings.session_max_age_seconds,
        ip_address=request_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
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
    user = _service.authenticate(session, payload.email, payload.password)
    if user is None or not user.active:
        _login_failed(session, request, key_hash, ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    record_login_attempt(session, key_hash, ip, succeeded=True)
    audit(session, "login.success", request=request, actor=user)
    csrf_token = _set_session_cookies(user, request, response, session)
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
    csrf_token = _set_session_cookies(result.user, request, response, session)
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
    revoke_user_sessions(session, user.id)
    audit(session, "credential.password_changed", request=request, actor=user, target=user)
    session.commit()
    response.status_code = status.HTTP_204_NO_CONTENT
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")
    return response
