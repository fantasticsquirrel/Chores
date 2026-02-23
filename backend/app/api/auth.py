from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session
from app.config import get_settings
from app.schemas.auth import AuthSessionResponse, AuthUserResponse, LoginRequest
from app.security.sessions import SESSION_COOKIE_NAME, create_session_token, parse_session_token
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
_service = AuthService()


def _build_session_response(user: object) -> AuthSessionResponse:
    return AuthSessionResponse(user=AuthUserResponse.model_validate(user))


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, response: Response, session: Session = Depends(get_db_session)) -> AuthSessionResponse:
    user = _service.authenticate(session, payload.email, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    settings = get_settings()
    token = create_session_token(settings.secret_key, user.id)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
    )
    session.commit()
    return _build_session_response(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> Response:
    response.status_code = status.HTTP_204_NO_CONTENT
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return response


@router.get("/me", response_model=AuthSessionResponse)
def get_current_session(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    session: Session = Depends(get_db_session),
) -> AuthSessionResponse:
    if session_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    settings = get_settings()
    user_id = parse_session_token(settings.secret_key, session_token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    user = _service.get_user(session, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    return _build_session_response(user)
