from __future__ import annotations

from collections.abc import Callable, Generator

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_session_factory
from app.models.core import Child, User
from app.models.enums import UserRole
from app.security.sessions import SESSION_COOKIE_NAME, resolve_session
from app.services.auth import AuthService
from app.services.modules import ModuleService

_auth_service = AuthService()
_module_service = ModuleService()


def get_db_session() -> Generator[Session, None, None]:
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        yield session


def get_current_user(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    session: Session = Depends(get_db_session),
) -> User:
    if session_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    auth_session = resolve_session(session, session_token)
    if auth_session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    user = _auth_service.get_user(session, auth_session.user_id)
    if user is None or not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    if user.role == UserRole.CHILD:
        child = session.get(Child, user.child_id)
        if child is None or not child.active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    return user


def require_roles(*allowed_roles: UserRole) -> Callable[[User], User]:
    def _require_roles(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
        return user

    return _require_roles


def require_module_access(module_key: str, *allowed_roles: UserRole) -> Callable[..., User]:
    """Require view access for safe methods and manage access for mutations."""

    def _require_module_access(
        request: Request,
        user: User = Depends(require_roles(*allowed_roles)),
        session: Session = Depends(get_db_session),
    ) -> User:
        manage = request.method.upper() not in {"GET", "HEAD", "OPTIONS"}
        if not _module_service.can_access_module(session, user, module_key, manage=manage):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Module access denied.")
        return user

    return _require_module_access


def require_module_view(module_key: str, *allowed_roles: UserRole) -> Callable[..., User]:
    def _require_module_view(
        request: Request,
        user: User = Depends(require_roles(*allowed_roles)),
        session: Session = Depends(get_db_session),
    ) -> User:
        _ = request
        if not _module_service.can_access_module(session, user, module_key, manage=False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Module access denied.")
        return user

    return _require_module_view


def require_module_manage(module_key: str, *allowed_roles: UserRole) -> Callable[..., User]:
    def _require_module_manage(
        request: Request,
        user: User = Depends(require_roles(*allowed_roles)),
        session: Session = Depends(get_db_session),
    ) -> User:
        _ = request
        if not _module_service.can_access_module(session, user, module_key, manage=True):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Module management access denied.")
        return user

    return _require_module_manage
