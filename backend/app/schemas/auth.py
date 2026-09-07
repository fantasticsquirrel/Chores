from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.models.enums import UserRole
from app.security.passwords import PARENT_PASSWORD_MIN_LENGTH, validate_parent_password


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)


class LoginAccountRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    account_token: str = Field(min_length=1, max_length=1024)
    password: str = Field(min_length=1, max_length=1024)


class LoginAccountResponse(BaseModel):
    account_token: str
    display_name: str
    mode: Literal["parent", "child"]


class ChildLoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    parent_email: str = Field(min_length=3, max_length=320)
    child_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=1024)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=PARENT_PASSWORD_MIN_LENGTH, max_length=1024)


class PasswordResetRequestPayload(BaseModel):
    # Public request accepts malformed-but-bounded values so it can answer with
    # the same generic 202 acknowledgement rather than validation detail.
    email: Any = ""


class PasswordResetConfirmPayload(BaseModel):
    token: Any = ""
    new_password: Any = ""


class PasswordResetResponse(BaseModel):
    detail: str


class RegistrationRequestPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=PARENT_PASSWORD_MIN_LENGTH, max_length=1024)
    household_name: str = Field(min_length=1, max_length=255)
    timezone: str = Field(default="UTC", min_length=1, max_length=64)

    @field_validator("password")
    @classmethod
    def valid_parent_password(cls, value: str) -> str:
        return validate_parent_password(value)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Choose a valid timezone.") from exc
        return value


class RegistrationVerifyPayload(BaseModel):
    token: Any = ""


class AuthUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    email: str
    role: UserRole
    child_id: int | None = None
    is_household_owner: bool = False


class AuthSessionResponse(BaseModel):
    user: AuthUserResponse
    csrf_token: str | None = None
