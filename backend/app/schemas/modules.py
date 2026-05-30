from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator

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


class CreateParentUserRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=1024)
    role: UserRole = UserRole.PARENT

    @model_validator(mode="after")
    def validate_parent_role(self) -> "CreateParentUserRequest":
        if self.role not in {UserRole.PARENT, UserRole.PARENT_ADMIN}:
            raise ValueError("Role must be PARENT or PARENT_ADMIN.")
        return self


class SetUserModuleAccessRequest(BaseModel):
    module_key: str = Field(min_length=1, max_length=64)
    can_view: bool
    can_manage: bool = False
