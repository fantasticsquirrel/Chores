from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: int
    module_key: str
    category: str
    severity: str
    title: str
    body: str
    link_url: str
    read_at: datetime | None
    created_at: datetime
    expires_at: datetime | None


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int


class NotificationSettingUpdate(BaseModel):
    in_app_enabled: bool | None = None
    push_enabled: bool | None = None
    daily_digest_enabled: bool | None = None
    daily_digest_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    due_soon_enabled: bool | None = None
    due_soon_hours: int | None = Field(default=None, ge=1, le=168)
    approval_notifications_enabled: bool | None = None
    quiet_hours_start: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    quiet_hours_end: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")


class NotificationSettingResponse(BaseModel):
    module_key: str
    settings: dict[str, Any]


class PushConfigResponse(BaseModel):
    vapid_public_key: str


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=2048)
    auth: str = Field(min_length=1, max_length=512)


class PushSubscriptionCreate(BaseModel):
    endpoint: str = Field(min_length=1, max_length=2000)
    keys: PushSubscriptionKeys
    device_label: str = Field(default="", max_length=255)


class PushSubscriptionResponse(BaseModel):
    id: int
    endpoint: str
    device_label: str
    enabled: bool
    created_at: datetime
    last_seen_at: datetime
