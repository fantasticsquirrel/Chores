from fastapi import HTTPException
from typing import NoReturn
from sqlalchemy import select
from app.models import User
from app.models.enums import UserRole
from app.models.family_tree import FamilyTreeCollection, FamilyTreePerson
from app.services.modules import ModuleService
from app.schemas.family_tree import DomainErrorDetail

def error(code, message, status=409, **extra) -> NoReturn:
    detail=DomainErrorDetail.model_validate({'code':code,'message':message,**extra})
    raise HTTPException(status_code=status, detail=detail.model_dump(mode='json',exclude_none=True,exclude_unset=True))

def authorize(session, actor, manage=False):
    current=session.scalar(select(User).where(User.id==actor.id).execution_options(populate_existing=True))
    if current is None or not current.active:
        raise HTTPException(401, 'Not authenticated.')
    if current.role not in {UserRole.PARENT,UserRole.PARENT_ADMIN} or not ModuleService().can_access_module(session,current,'family-tree',manage=manage):
        raise HTTPException(403, 'Module access denied.')
    return current

def collection(session, household_id):
    return session.scalar(select(FamilyTreeCollection).where(FamilyTreeCollection.household_id==household_id).execution_options(populate_existing=True))

def scoped(session, model, household_id, object_id):
    row=session.scalar(select(model).where(model.id==object_id,model.household_id==household_id).execution_options(populate_existing=True))
    if row is None:
        raise HTTPException(404,'Not found.')
    return row

def person(session, household_id, person_id, editable=False, allow_locked=False):
    row=scoped(session,FamilyTreePerson,household_id,person_id)
    if editable:
        if row.merged_into_person_id is not None:
            error('person_merged','Open the canonical person before submitting a new command.',canonical_person_id=row.merged_into_person_id)
        if row.is_locked and not allow_locked:
            error('person_locked','Unlock this person before editing.')
    return row
