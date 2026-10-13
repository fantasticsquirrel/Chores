from sqlalchemy import select,update,func
from app.models.family_tree import FamilyTreeStory,FamilyTreeResidence
from app.schemas.family_tree import StoryData,ResidenceData,chronology
from .access import authorize,collection,person,scoped,error
from .serialization import record_dto

RECORDS={'stories':(FamilyTreeStory,StoryData,'story_ids'),'residences':(FamilyTreeResidence,ResidenceData,'residence_ids')}

def page(session,actor,pid,kind,limit=50,cursor=None):
    authorize(session,actor); person(session,actor.household_id,pid)
    model,_,_=RECORDS[kind]
    stmt=select(model).where(model.household_id==actor.household_id,model.person_id==pid)
    if kind=='stories':
        if cursor:
            last=scoped(session,model,actor.household_id,cursor)
            if last.person_id!=pid: error('validation_error','Invalid cursor.',422)
            stmt=stmt.where((model.position>last.position)|((model.position==last.position)&(model.id>last.id)))
        stmt=stmt.order_by(model.position,model.id)
    else:
        if cursor: stmt=stmt.where(model.id>cursor)
        stmt=stmt.order_by(model.id)
    rows=list(session.scalars(stmt.limit(limit+1)))
    return {'graph_revision':collection(session,actor.household_id).revision,'items':[record_dto(r) for r in rows[:limit]],'next_cursor':rows[limit-1].id if len(rows)>limit else None}

def change(session,actor,c,kind,pid=None,data=None,rid=None,changes=None,remove=False):
    model,dto,key=RECORDS[kind]
    old=scoped(session,model,actor.household_id,rid) if rid else None
    if old is None:
        count=sum(session.scalar(select(func.count()).select_from(m).where(m.household_id==actor.household_id)) or 0 for m in [FamilyTreeStory,FamilyTreeResidence])
        if count>=40000:error('resource_limit','Collection record limit exceeded.',413)
    pid=old.person_id if old else pid
    person(session,actor.household_id,pid,editable=True)
    if remove:
        session.delete(old); return {'person_ids':[pid],key:[old.id]},[]
    if changes is not None:
        patch=changes.model_dump(mode='json',exclude_unset=True)
        if not patch: error('validation_error','Empty patches are unsupported.',422)
        combined={k:v for k,v in record_dto(old).items() if k not in {'id','person_id','position','created_by_user_id'}}
        data=dto.model_validate({**combined,**patch})
        if data.model_dump(mode='json')==combined:error('validation_error','This patch does not change any facts.',422)
    row=old or model(household_id=actor.household_id,collection_id=c.id,person_id=pid,created_by_user_id=actor.id)
    facts=data.model_dump(mode='json')
    if kind=='residences':
        primary=facts.pop('is_primary')
        if primary:
            session.execute(update(model).where(model.household_id==actor.household_id,model.person_id==pid).values(is_primary=False))
        row.is_primary=primary
    elif old is None:
        row.position=(session.scalar(select(func.max(model.position)).where(model.household_id==actor.household_id,model.person_id==pid)) or 0)+1
    row.facts=facts; session.add(row); session.flush()
    return {'person_ids':[pid],key:[row.id]},chronology(getattr(data,'start_date',None),getattr(data,'end_date',None))

def reorder(session,actor,c,pid,ids):
    person(session,actor.household_id,pid,editable=True)
    rows=list(session.scalars(select(FamilyTreeStory).where(FamilyTreeStory.household_id==actor.household_id,FamilyTreeStory.person_id==pid).limit(1001)))
    if len(rows)>1000: error('resource_limit','Story reorder limit exceeded.',413)
    if len(ids)!=len(set(ids)) or set(ids)!={r.id for r in rows}: error('validation_error','Supply each story exactly once.',422)
    if [r.id for r in sorted(rows,key=lambda r:(r.position,r.id))]==ids:error('validation_error','This reorder does not change the order.',422)
    positions={sid:i for i,sid in enumerate(ids)}
    for row in rows: row.position=positions[row.id]
    return {'person_ids':[pid],'story_ids':ids},[]
