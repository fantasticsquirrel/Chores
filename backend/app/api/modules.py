from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db_session, require_module_access, require_module_manage
from app.models.core import User
from app.models.enums import UserRole
from app.modules import MODULE_ADMIN
from app.schemas.modules import (
    CreateParentUserRequest,
    HouseholdModuleAccessResponse,
    ModuleResponse,
    MyModulesResponse,
    SetHouseholdModuleAccessRequest,
    SetUserModuleAccessRequest,
    UserModuleAccessResponse,
)
from app.security import hash_password
from app.security.audit import audit
from app.services.modules import ModuleService

router = APIRouter(prefix="/modules", tags=["modules"])
_service = ModuleService()
_require_admin_module_access = require_module_access(MODULE_ADMIN, UserRole.PARENT_ADMIN)
_require_admin_module_manage = require_module_manage(MODULE_ADMIN, UserRole.PARENT_ADMIN)


def _module_response(module, session: Session, user: User) -> ModuleResponse:
    return ModuleResponse(
        key=module.key,
        name=module.name,
        description=module.description,
        can_manage=_service.can_access_module(session, user, module.key, manage=True),
    )


@router.get("/me", response_model=MyModulesResponse)
def get_my_modules(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> MyModulesResponse:
    return MyModulesResponse(
        modules=[_module_response(module, session, current_user) for module in _service.list_effective_modules(session, current_user)]
    )


def _household_module_response(module, *, enabled: bool) -> HouseholdModuleAccessResponse:
    return HouseholdModuleAccessResponse(
        key=module.key,
        name=module.name,
        description=module.description,
        can_manage=True,
        enabled=enabled,
        can_disable=module.key != MODULE_ADMIN,
    )


@router.get("/household", response_model=list[HouseholdModuleAccessResponse])
def list_household_modules(
    current_user: User = Depends(_require_admin_module_manage),
    session: Session = Depends(get_db_session),
) -> list[HouseholdModuleAccessResponse]:
    return [
        _household_module_response(module, enabled=enabled)
        for module, enabled in _service.list_household_access(session, current_user.household_id)
    ]


@router.put("/household/{module_key}", response_model=HouseholdModuleAccessResponse)
def set_household_module_access(
    module_key: str,
    payload: SetHouseholdModuleAccessRequest,
    request: Request,
    current_user: User = Depends(_require_admin_module_manage),
    session: Session = Depends(get_db_session),
) -> HouseholdModuleAccessResponse:
    household_access = _service.list_household_access(session, current_user.household_id)
    previous = next((enabled for module, enabled in household_access if module.key == module_key), None)
    try:
        module, enabled = _service.set_household_access(
            session,
            household_id=current_user.household_id,
            module_key=module_key,
            enabled=payload.enabled,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    audit(
        session,
        "module.household_access_changed",
        request=request,
        actor=current_user,
        details={
            "module_key": module_key,
            "previous_enabled": previous,
            "enabled": enabled,
        },
    )
    session.commit()
    return _household_module_response(module, enabled=enabled)


@router.get("/users", response_model=list[UserModuleAccessResponse])
def list_household_user_module_access(
    current_user: User = Depends(_require_admin_module_access),
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
            modules=[_module_response(module, session, user) for module in modules],
        )
        for user, modules in rows
    ]


@router.post("/users", response_model=UserModuleAccessResponse, status_code=status.HTTP_201_CREATED)
def create_parent_user(
    payload: CreateParentUserRequest,
    request: Request,
    current_user: User = Depends(_require_admin_module_access),
    session: Session = Depends(get_db_session),
) -> UserModuleAccessResponse:
    normalized_email = payload.email.strip().lower()
    email_taken = session.scalar(select(User).where(User.email == normalized_email))
    if email_taken is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already in use.")

    user = User(
        household_id=current_user.household_id,
        email=normalized_email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        child_id=None,
    )
    session.add(user)
    session.flush()
    audit(session, "account.parent_created", request=request, actor=current_user, target=user)

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not create parent account.") from exc

    session.refresh(user)
    modules = _service.list_effective_modules(session, user)
    return UserModuleAccessResponse(
        id=user.id,
        household_id=user.household_id,
        email=user.email,
        role=user.role,
        child_id=user.child_id,
        modules=[_module_response(module, session, user) for module in modules],
    )


@router.put("/users/{user_id}", response_model=UserModuleAccessResponse)
def set_user_module_access(
    user_id: int,
    payload: SetUserModuleAccessRequest,
    request: Request,
    current_user: User = Depends(_require_admin_module_access),
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

    audit(
        session,
        "module.permission_changed",
        request=request,
        actor=current_user,
        target=target_user,
        details={"module_key": payload.module_key, "can_view": payload.can_view, "can_manage": payload.can_manage},
    )
    session.commit()
    modules = _service.list_effective_modules(session, target_user)
    return UserModuleAccessResponse(
        id=target_user.id,
        household_id=target_user.household_id,
        email=target_user.email,
        role=target_user.role,
        child_id=target_user.child_id,
        modules=[_module_response(module, session, target_user) for module in modules],
    )
