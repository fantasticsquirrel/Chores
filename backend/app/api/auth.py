from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db_session
from app.models.core import User
from app.config import get_settings
from app.schemas.auth import AuthSessionResponse, AuthUserResponse, LoginRequest
from app.security.csrf import CSRF_COOKIE_NAME, create_csrf_token
from app.security.sessions import (
    SESSION_COOKIE_MAX_AGE_SECONDS,
    SESSION_COOKIE_NAME,
    create_session_token,
)
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
_service = AuthService()


def _build_session_response(user: object, *, csrf_token: str | None = None) -> AuthSessionResponse:
    return AuthSessionResponse(user=AuthUserResponse.model_validate(user), csrf_token=csrf_token)


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, response: Response, session: Session = Depends(get_db_session)) -> AuthSessionResponse:
    user = _service.authenticate(session, payload.email, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    settings = get_settings()
    token = create_session_token(settings.secret_key, user.id)
    csrf_token = create_csrf_token()
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        max_age=SESSION_COOKIE_MAX_AGE_SECONDS,
        path="/",
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        samesite="lax",
        secure=settings.session_cookie_secure,
        max_age=SESSION_COOKIE_MAX_AGE_SECONDS,
        path="/",
    )
    session.commit()
    return _build_session_response(user, csrf_token=csrf_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> Response:
    response.status_code = status.HTTP_204_NO_CONTENT
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")
    return response


@router.get("/me", response_model=AuthSessionResponse)
def get_current_session(
    user: User = Depends(get_current_user),
) -> AuthSessionResponse:
    return _build_session_response(user)
