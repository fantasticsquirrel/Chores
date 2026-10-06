"""Native Expo subscription API. Browser push routes are intentionally separate."""
from datetime import UTC, datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db_session
from app.config import get_settings
from app.models import AuthSession, NativePushSubscription, User
from app.schemas.native_push import (NativePushConfigResponse, NativePushSubscriptionCreate,
                                     NativePushSubscriptionList, NativePushSubscriptionResponse)
from app.security.sessions import SESSION_COOKIE_NAME, resolve_session
from app.services.native_push_subscriptions import NativePushConflict, register_native_subscription

router = APIRouter(prefix="/push/native", tags=["notifications"])


def current_auth_session(
    token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    session: Session = Depends(get_db_session), user: User = Depends(get_current_user),
) -> AuthSession:
    auth = resolve_session(session, token) if token else None
    if auth is None or auth.user_id != user.id:
        raise HTTPException(401, "Not authenticated.")
    return auth


@router.get("/config", response_model=NativePushConfigResponse)
def native_push_config(_: AuthSession = Depends(current_auth_session)) -> NativePushConfigResponse:
    return NativePushConfigResponse(enabled=get_settings().native_push_enabled)


@router.post("/subscriptions", response_model=NativePushSubscriptionResponse, status_code=201)
def create_native_subscription(
    payload: NativePushSubscriptionCreate, session: Session = Depends(get_db_session),
    user: User = Depends(get_current_user), auth: AuthSession = Depends(current_auth_session),
) -> NativePushSubscriptionResponse:
    if not get_settings().native_push_enabled:
        raise HTTPException(503, "Native push is disabled.")
    try:
        row = register_native_subscription(session, user=user, auth=auth, token=payload.token, platform=payload.platform)
        session.commit()
    except (NativePushConflict, IntegrityError, OperationalError):
        # Database errors may contain bind parameters (including push tokens).
        session.rollback()
        raise HTTPException(409, "Native push token already registered.") from None
    return NativePushSubscriptionResponse.model_validate(row)


@router.get("/subscriptions", response_model=NativePushSubscriptionList)
def list_native_subscriptions(
    session: Session = Depends(get_db_session), user: User = Depends(get_current_user),
    auth: AuthSession = Depends(current_auth_session),
) -> NativePushSubscriptionList:
    rows = session.scalars(select(NativePushSubscription).where(
        NativePushSubscription.user_id == user.id, NativePushSubscription.session_id == auth.id,
        NativePushSubscription.household_id == user.household_id,
    ).order_by(NativePushSubscription.id)).all()
    return NativePushSubscriptionList(items=[NativePushSubscriptionResponse.model_validate(row) for row in rows])


@router.delete("/subscriptions/{subscription_id}", status_code=204)
def disable_native_subscription(
    subscription_id: int = Path(gt=0), session: Session = Depends(get_db_session),
    user: User = Depends(get_current_user), auth: AuthSession = Depends(current_auth_session),
) -> None:
    row = session.scalar(select(NativePushSubscription).where(
        NativePushSubscription.id == subscription_id, NativePushSubscription.user_id == user.id,
        NativePushSubscription.session_id == auth.id, NativePushSubscription.household_id == user.household_id,
    ))
    if row is None:
        raise HTTPException(404, "Native push subscription not found.")
    row.enabled = False
    row.disabled_at = datetime.now(UTC)
    session.commit()
