from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SupportTicketCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=10_000)
    category: Literal["account", "chores", "homeschool", "recipes", "billing", "bug", "feature", "other"] = "other"
    idempotency_key: str = Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")
    environment: str = Field(default="web", max_length=32)
    app_version: str = Field(default="", max_length=64)


class SupportTicketReply(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    body: str = Field(min_length=1, max_length=10_000)


class SupportTicketResponse(BaseModel):
    id: int
    ticket_number: str
    title: str
    state: str
    created_at: datetime
    updated_at: datetime
    articles: list[dict[str, object]] = Field(default_factory=list)


class SupportStatusResponse(BaseModel):
    enabled: bool

