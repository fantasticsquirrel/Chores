from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import EntitlementStatus


class BillingStatusResponse(BaseModel):
    household_id: int
    billing_account_id: str
    plan_key: str
    status: EntitlementStatus
    provider: str | None = None
    plan_name: str | None = None
    expires_at: datetime | None = None
    current_period_ends_at: datetime | None = None
    available_actions: list[dict[str, str]] = Field(default_factory=list)


class OpsLoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)
    totp_code: str = Field(pattern=r"^\d{6}$")


class OpsReauthRequest(BaseModel):
    password: str = Field(min_length=1, max_length=1024)
    totp_code: str = Field(pattern=r"^\d{6}$")


class ComplimentaryRequest(BaseModel):
    expires_at: datetime
    reason: str = Field(min_length=3, max_length=1000)
    idempotency_key: str = Field(min_length=3, max_length=255)


class SupportCaseCreate(BaseModel):
    household_id: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=1000)


class SupportNoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ReconcileRequest(BaseModel):
    case_id: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=1000)
