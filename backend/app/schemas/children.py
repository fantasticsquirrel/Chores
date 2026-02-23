from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ChildResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    name: str
    active: bool


class CreateChildRequest(BaseModel):
    household_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    active: bool = True


class UpdateChildRequest(BaseModel):
    household_id: int = Field(gt=0)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    active: bool | None = None
