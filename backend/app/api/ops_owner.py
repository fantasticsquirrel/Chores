"""Authoritative PLATFORM_OWNER web operations, separate from support APIs."""
from typing import Annotated
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import StringConstraints
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session
from app.api.ops_dependencies import PlatformPrincipal, require_platform_roles
from app.models.enums import PlatformRole
from app.schemas.ops_owner import (
    GlobalModule, HouseholdModule, ModuleChange, OwnerAccounts, OwnerHouseholds, OwnerOverview,
)
from app.security.platform_sessions import has_recent_reauth
from app.services.ops import audit, owner_management

PRIVATE_HEADERS = {"Cache-Control": "private, no-store"}


class PrivateOwnerRoute(APIRoute):
    """Apply privacy to successful reads and dependency/validation failures alike."""
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def private_handler(request: Request):
            try:
                response = await handler(request)
            except HTTPException as exc:
                exc.headers = {**(exc.headers or {}), **PRIVATE_HEADERS}
                raise
            except RequestValidationError as exc:
                return JSONResponse(status_code=422, content={"detail": jsonable_encoder(exc.errors())}, headers=PRIVATE_HEADERS)
            except Exception as exc:
                # Keep operational identity/errors private even when the outer
                # generic exception handler would omit cache headers. Metadata
                # only: database errors may include submitted fields.
                logging.getLogger(__name__).error(
                    "owner.request_failed method=%s path=%s exception_type=%s",
                    request.method, request.url.path, type(exc).__name__,
                )
                return JSONResponse(status_code=500, content={"error": {"message": "Internal server error."}}, headers=PRIVATE_HEADERS)
            response.headers.update(PRIVATE_HEADERS)
            return response

        return private_handler


router = APIRouter(prefix="/owner", tags=["platform-owner"], route_class=PrivateOwnerRoute)
_owner = require_platform_roles(PlatformRole.OWNER)
Offset = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=50)]
Search = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


@router.get("/overview", response_model=OwnerOverview)
def overview(db: Session = Depends(get_db_session), _: PlatformPrincipal = Depends(_owner)):
    return owner_management.overview(db)


@router.get("/households", response_model=OwnerHouseholds)
def households(query: Search = "", offset: Offset = 0, limit: Limit = 25,
               db: Session = Depends(get_db_session), _: PlatformPrincipal = Depends(_owner)):
    return owner_management.list_households(db, query, offset, limit)


@router.get("/modules", response_model=list[GlobalModule])
def global_modules(db: Session = Depends(get_db_session), _: PlatformPrincipal = Depends(_owner)):
    return owner_management.list_global_modules(db)


@router.get("/households/{household_id}/modules", response_model=list[HouseholdModule])
def household_modules(household_id: int, db: Session = Depends(get_db_session),
                      _: PlatformPrincipal = Depends(_owner)):
    return owner_management.list_household_modules(db, household_id)


@router.get("/households/{household_id}/accounts", response_model=OwnerAccounts)
def accounts(household_id: int, offset: Offset = 0, limit: Limit = 25,
             db: Session = Depends(get_db_session), _: PlatformPrincipal = Depends(_owner)):
    return owner_management.list_accounts(db, household_id, offset, limit)


def _change(db: Session, principal: PlatformPrincipal, module_key: str,
            household_id: int | None, payload: ModuleChange):
    if not has_recent_reauth(principal.auth_session):
        raise HTTPException(403, "Recent reauthentication required.")
    try:
        result = owner_management.change_module(
            db, module_key=module_key, household_id=household_id,
            enabled=payload.enabled, expected_enabled=payload.expected_enabled,
        )
        audit.record_platform_audit(
            db, "module.global_access_changed" if household_id is None else "module.household_access_changed",
            actor_platform_user_id=principal.user.id, household_id=household_id, reason=payload.reason,
            details={"module_key": module_key, "previous_enabled": payload.expected_enabled, "enabled": payload.enabled},
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return result


@router.post("/modules/{module_key}", response_model=GlobalModule)
def change_global_module(module_key: str, payload: ModuleChange,
                         db: Session = Depends(get_db_session), principal: PlatformPrincipal = Depends(_owner)):
    return _change(db, principal, module_key, None, payload)


@router.post("/households/{household_id}/modules/{module_key}", response_model=HouseholdModule)
def change_household_module(household_id: int, module_key: str, payload: ModuleChange,
                            db: Session = Depends(get_db_session), principal: PlatformPrincipal = Depends(_owner)):
    return _change(db, principal, module_key, household_id, payload)
