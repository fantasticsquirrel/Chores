from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import UserRole


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)


class ChildLoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    parent_email: str = Field(min_length=3, max_length=320)
    child_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=1024)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=8, max_length=1024)


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
