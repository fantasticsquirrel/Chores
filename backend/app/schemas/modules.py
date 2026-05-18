from __future__ import annotations

from pydantic import BaseModel


class ModuleResponse(BaseModel):
    key: str
    name: str
    description: str


class MyModulesResponse(BaseModel):
    modules: list[ModuleResponse]
