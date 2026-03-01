from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import UserRole


class ChildResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    name: str
    active: bool


class CreateChildRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    active: bool = True


class UpdateChildRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    active: bool | None = None

    @model_validator(mode="after")
    def validate_patch_fields(self) -> "UpdateChildRequest":
        if self.name is None and self.active is None:
            raise ValueError("At least one field must be provided for update.")
        return self


class CreateChildAccountRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    email: str | None = Field(default=None, min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=1024)


class ResetChildAccountEmailRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    email: str | None = Field(default=None, min_length=3, max_length=320)


class ChildAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    email: str
    role: UserRole
    child_id: int
