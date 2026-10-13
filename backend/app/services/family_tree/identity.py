from sqlalchemy import select,or_
from app.models import User,Child
from app.models.enums import UserRole
from app.models.family_tree import FamilyTreeIdentityLink
from .access import authorize,person,error

def candidates(session,actor):
    authorize(session,actor,manage=True)
    users=list(session.scalars(select(User).where(User.household_id==actor.household_id,User.role.in_([UserRole.PARENT,UserRole.PARENT_ADMIN]),User.active.is_(True)).order_by(User.id).limit(101)))
    children=list(session.scalars(select(Child).where(Child.household_id==actor.household_id,Child.active.is_(True)).order_by(Child.id).limit(101)))
    if len(users)>100 or len(children)>100: error('resource_limit','Identity candidate limit exceeded.',413)
    return {'items':[{'kind':'user','id':u.id,'label':f'Adult household account {u.id}','active':u.active} for u in users]+[{'kind':'child','id':ch.id,'label':ch.name,'active':ch.active} for ch in children]}

def change(session,actor,c,pid,command,remove=False):
    person(session,actor.household_id,pid,editable=True)
    existing=session.scalar(select(FamilyTreeIdentityLink).where(FamilyTreeIdentityLink.household_id==actor.household_id,FamilyTreeIdentityLink.person_id==pid))
    if remove:
        if existing is None:error('validation_error','This person has no association to unlink.',422)
        session.delete(existing)
        return {'person_ids':[pid]},[]
    model=User if command.user_id else Child
    target_id=command.user_id or command.child_id
    target=session.scalar(select(model).where(model.household_id==actor.household_id,model.id==target_id,model.active.is_(True)))
    if target is None or (model is User and target.role not in {UserRole.PARENT,UserRole.PARENT_ADMIN}): error('validation_error','Choose an eligible household identity.',422)
    conflict=session.scalar(select(FamilyTreeIdentityLink.id).where(FamilyTreeIdentityLink.household_id==actor.household_id,FamilyTreeIdentityLink.collection_id==c.id,FamilyTreeIdentityLink.person_id!=pid,(FamilyTreeIdentityLink.user_id==target_id) if model is User else (FamilyTreeIdentityLink.child_id==target_id)))
    if conflict or (existing and (existing.user_id!=command.user_id or existing.child_id!=command.child_id)): error('identity_link_conflict','Unlink the existing association before linking a different identity.')
    if existing:error('validation_error','This association is already linked.',422)
    row=existing or FamilyTreeIdentityLink(household_id=actor.household_id,collection_id=c.id,person_id=pid,created_by_user_id=actor.id,user_id=command.user_id,child_id=command.child_id)
    session.add(row);session.flush()
    return {'person_ids':[pid],'identity_link_ids':[row.id]},[]
