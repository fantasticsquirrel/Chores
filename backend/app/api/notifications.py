from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db_session, require_module_access
from app.config import get_settings
from app.models.core import Notification, User
from app.models.enums import UserRole
from app.modules import MODULE_CHORES
from app.schemas.notifications import (
    NotificationListResponse,
    NotificationResponse,
    NotificationSettingResponse,
    NotificationSettingUpdate,
    PushConfigResponse,
    PushSubscriptionCreate,
    PushSubscriptionResponse,
)
from app.services.notifications import (
    get_user_notification_settings,
    update_user_notification_settings,
    upsert_push_subscription,
)

router = APIRouter(tags=["notifications"])
_REQUIRE_AUTH = require_module_access(MODULE_CHORES, UserRole.PARENT, UserRole.PARENT_ADMIN, UserRole.CHILD)


def _serialize_notification(notification: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=notification.id,
        module_key=notification.module_key,
        category=notification.category,
        severity=notification.severity,
        title=notification.title,
        body=notification.body,
        link_url=notification.link_url,
        read_at=notification.read_at,
        created_at=notification.created_at,
        expires_at=notification.expires_at,
    )


@router.get("/notifications", response_model=NotificationListResponse)
def list_my_notifications(
    unread: int = Query(default=0, ge=0, le=1),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_AUTH),
) -> NotificationListResponse:
    query = select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit)
    if unread:
        query = query.where(Notification.read_at.is_(None))
    rows = list(session.scalars(query).all())
    unread_count = session.scalar(
        select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))
    ) or 0
    return NotificationListResponse(items=[_serialize_notification(row) for row in rows], unread_count=int(unread_count))


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int = Path(gt=0),
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_AUTH),
) -> dict[str, bool]:
    notification = session.get(Notification, notification_id)
    if notification is None or notification.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    notification.read_at = notification.read_at or datetime.now(UTC)
    session.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_AUTH),
) -> dict[str, int]:
    now = datetime.now(UTC)
    rows = list(session.scalars(select(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))).all())
    for row in rows:
        row.read_at = now
    session.commit()
    return {"updated": len(rows)}


@router.get("/notification-settings")
def get_my_notification_settings(
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_AUTH),
) -> dict[str, dict]:
    return get_user_notification_settings(session, user.id)


@router.put("/notification-settings/{module_key}", response_model=NotificationSettingResponse)
def update_my_notification_settings(
    payload: NotificationSettingUpdate,
    module_key: str = Path(min_length=1),
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_AUTH),
) -> NotificationSettingResponse:
    try:
        settings = update_user_notification_settings(session, user.id, module_key, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return NotificationSettingResponse(module_key=module_key, settings=settings)


@router.get("/push/config", response_model=PushConfigResponse)
def get_push_config(_: User = Depends(get_current_user)) -> PushConfigResponse:
    settings = get_settings()
    return PushConfigResponse(vapid_public_key=settings.push_vapid_public_key)


@router.post("/push/subscriptions", response_model=PushSubscriptionResponse, status_code=status.HTTP_201_CREATED)
def create_push_subscription(
    payload: PushSubscriptionCreate,
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_AUTH),
) -> PushSubscriptionResponse:
    row = upsert_push_subscription(
        session,
        user_id=user.id,
        endpoint=payload.endpoint,
        p256dh=payload.keys.p256dh,
        auth=payload.keys.auth,
        device_label=payload.device_label,
    )
    return PushSubscriptionResponse(
        id=row.id,
        endpoint=row.endpoint,
        device_label=row.device_label,
        enabled=row.enabled,
        created_at=row.created_at,
        last_seen_at=row.last_seen_at,
    )
