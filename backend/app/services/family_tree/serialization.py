from sqlalchemy import select
from app.models import Child,User
from app.models.family_tree import FamilyTreeIdentityLink,FamilyTreePersonTag,FamilyTreeOtherName,FamilyTreeMediaReference

def stamp(value): return value.isoformat() if value else None

def person_dto(session,row):
    tags=list(session.scalars(select(FamilyTreePersonTag.tag).where(FamilyTreePersonTag.household_id==row.household_id,FamilyTreePersonTag.person_id==row.id).order_by(FamilyTreePersonTag.tag)))
    aliases=[{'id':alias.id,'name':alias.name,'label':alias.label,'created_by_user_id':alias.created_by_user_id,'created_at':stamp(alias.created_at)} for alias in session.scalars(select(FamilyTreeOtherName).where(FamilyTreeOtherName.household_id==row.household_id,FamilyTreeOtherName.person_id==row.id).order_by(FamilyTreeOtherName.position,FamilyTreeOtherName.id))]
    return {**row.facts,'aliases':aliases,'tags':tags,'id':row.id,'created_by_user_id':row.created_by_user_id,'created_at':stamp(row.created_at),'updated_at':stamp(row.updated_at),'is_locked':row.is_locked,'lock_reason':row.lock_reason,'locked_by_user_id':row.locked_by_user_id,'locked_at':stamp(row.locked_at),'archived_at':stamp(row.archived_at),'merged_into_person_id':row.merged_into_person_id,'primary_image_asset_id':session.scalar(select(FamilyTreeMediaReference.asset_id).where(FamilyTreeMediaReference.household_id==row.household_id,FamilyTreeMediaReference.person_id==row.id,FamilyTreeMediaReference.role=='primary'))}

def record_dto(row):
    result={**row.facts,'id':row.id,'created_by_user_id':row.created_by_user_id}
    for key in ['person_id','position','is_primary','parent_person_id','child_person_id','caregiver_person_id','recipient_person_id','person_a_id','person_b_id','kind']:
        if hasattr(row,key): result[key]=getattr(row,key)
    return result

def identity_dto(session,person):
    link=session.scalar(select(FamilyTreeIdentityLink).where(FamilyTreeIdentityLink.household_id==person.household_id,FamilyTreeIdentityLink.person_id==person.id))
    if link is None: return None
    model=User if link.user_id else Child
    target=session.scalar(select(model).where(model.id==(link.user_id or link.child_id),model.household_id==person.household_id))
    return {'id':link.id,'person_id':person.id,'user_id':link.user_id,'child_id':link.child_id,'active':bool(target and target.active),'label':target.name if model is Child else 'Adult household account'}
