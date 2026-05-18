from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db_session, require_roles
from app.models.core import User
from app.models.enums import UserRole
from app.schemas.modules import (
    ModuleResponse,
    MyModulesResponse,
    SetUserModuleAccessRequest,
    UserModuleAccessResponse,
)
from app.services.modules import ModuleService

router = APIRouter(prefix="/modules", tags=["modules"])
_service = ModuleService()


def _module_response(module) -> ModuleResponse:
    return ModuleResponse(key=module.key, name=module.name, description=module.description)


@router.get("/me", response_model=MyModulesResponse)
def get_my_modules(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> MyModulesResponse:
    return MyModulesResponse(modules=[_module_response(module) for module in _service.list_effective_modules(session, current_user)])


@router.get("/users", response_model=list[UserModuleAccessResponse])
def list_household_user_module_access(
    current_user: User = Depends(require_roles(UserRole.PARENT_ADMIN)),
    session: Session = Depends(get_db_session),
) -> list[UserModuleAccessResponse]:
    rows = _service.list_household_user_access(session, current_user.household_id)
    return [
        UserModuleAccessResponse(
            id=user.id,
            household_id=user.household_id,
            email=user.email,
            role=user.role,
            child_id=user.child_id,
            modules=[_module_response(module) for module in modules],
        )
        for user, modules in rows
    ]


@router.put("/users/{user_id}", response_model=UserModuleAccessResponse)
def set_user_module_access(
    user_id: int,
    payload: SetUserModuleAccessRequest,
    current_user: User = Depends(require_roles(UserRole.PARENT_ADMIN)),
    session: Session = Depends(get_db_session),
) -> UserModuleAccessResponse:
    target_user = session.get(User, user_id)
    if target_user is None or target_user.household_id != current_user.household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    try:
        _service.set_user_access(
            session,
            target_user=target_user,
            module_key=payload.module_key,
            can_view=payload.can_view,
            can_manage=payload.can_manage,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    session.commit()
    modules = _service.list_effective_modules(session, target_user)
    return UserModuleAccessResponse(
        id=target_user.id,
        household_id=target_user.household_id,
        email=target_user.email,
        role=target_user.role,
        child_id=target_user.child_id,
        modules=[_module_response(module) for module in modules],
    )
