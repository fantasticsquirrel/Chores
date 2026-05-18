from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db_session
from app.models.core import User
from app.config import get_settings
from app.schemas.auth import AuthSessionResponse, AuthUserResponse, ChangePasswordRequest, LoginRequest
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


def _request_uses_https(request: Request) -> bool:
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    if forwarded_proto.split(",", 1)[0].strip().lower() == "https":
        return True
    return request.url.scheme == "https"


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, request: Request, response: Response, session: Session = Depends(get_db_session)) -> AuthSessionResponse:
    user = _service.authenticate(session, payload.email, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    settings = get_settings()
    token = create_session_token(settings.secret_key, user.id)
    csrf_token = create_csrf_token()
    secure_cookie = settings.session_cookie_secure or _request_uses_https(request)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=secure_cookie,
        max_age=SESSION_COOKIE_MAX_AGE_SECONDS,
        path="/",
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        samesite="lax",
        secure=secure_cookie,
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


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    session: Session = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> Response:
    if not _service.change_password(
        session=session,
        user=user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
