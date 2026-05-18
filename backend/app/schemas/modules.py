from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import UserRole


class ModuleResponse(BaseModel):
    key: str
    name: str
    description: str


class MyModulesResponse(BaseModel):
    modules: list[ModuleResponse]


class UserModuleAccessResponse(BaseModel):
    id: int
    household_id: int
    email: str
    role: UserRole
    child_id: int | None = None
    modules: list[ModuleResponse]


class SetUserModuleAccessRequest(BaseModel):
    module_key: str = Field(min_length=1, max_length=64)
    can_view: bool
    can_manage: bool = False
