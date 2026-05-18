from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.models.core import User
from app.modules import get_modules_for_role
from app.schemas.modules import ModuleResponse, MyModulesResponse

router = APIRouter(prefix="/modules", tags=["modules"])


@router.get("/me", response_model=MyModulesResponse)
def get_my_modules(current_user: User = Depends(get_current_user)) -> MyModulesResponse:
    return MyModulesResponse(
        modules=[
            ModuleResponse(key=module.key, name=module.name, description=module.description)
            for module in get_modules_for_role(current_user.role)
        ]
    )
