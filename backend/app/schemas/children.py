from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
