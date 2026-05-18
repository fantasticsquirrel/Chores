from __future__ import annotations

from collections.abc import Callable, Generator

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_session_factory
from app.models.core import User
from app.models.enums import UserRole
from app.security.sessions import SESSION_COOKIE_NAME, parse_session_token
from app.services.auth import AuthService
from app.services.modules import ModuleService, module_keys

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

    settings = get_settings()
    user_id = parse_session_token(settings.secret_key, session_token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    user = _auth_service.get_user(session, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    return user


def require_roles(*allowed_roles: UserRole) -> Callable[[User], User]:
    def _require_roles(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
        return user

    return _require_roles


def require_module_access(module_key: str, *allowed_roles: UserRole) -> Callable[[User, Session], User]:
    def _require_module_access(
        user: User = Depends(require_roles(*allowed_roles)),
        session: Session = Depends(get_db_session),
    ) -> User:
        if module_key not in module_keys(_module_service.list_effective_modules(session, user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Module access denied.")
        return user

    return _require_module_access
