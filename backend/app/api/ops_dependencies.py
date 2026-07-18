from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session
from app.models.enums import PlatformRole
from app.models.platform import PlatformSession, PlatformUser
from app.security.platform_sessions import OPS_CSRF_COOKIE_NAME, OPS_CSRF_HEADER_NAME, OPS_SESSION_COOKIE_NAME, resolve_platform_session


@dataclass
class PlatformPrincipal:
    user: PlatformUser
    auth_session: PlatformSession


def get_platform_principal(
    request: Request,
    token: str | None = Cookie(default=None, alias=OPS_SESSION_COOKIE_NAME),
    csrf: str | None = Cookie(default=None, alias=OPS_CSRF_COOKIE_NAME),
    session: Session = Depends(get_db_session),
) -> PlatformPrincipal:
    auth_session = resolve_platform_session(session, token)
    if auth_session is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    user = session.get(PlatformUser, auth_session.platform_user_id)
    if user is None or not user.active:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        header = request.headers.get(OPS_CSRF_HEADER_NAME)
        if not csrf or not header or not __import__("hmac").compare_digest(csrf, header):
            raise HTTPException(status_code=403, detail="CSRF token missing or invalid.")
    return PlatformPrincipal(user=user, auth_session=auth_session)


def require_platform_roles(*roles: PlatformRole) -> Callable[..., PlatformPrincipal]:
    def dependency(principal: PlatformPrincipal = Depends(get_platform_principal)) -> PlatformPrincipal:
        if principal.user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
        return principal
    return dependency
