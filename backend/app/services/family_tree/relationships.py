from sqlalchemy import select,func
from app.models.family_tree import FamilyTreeParentLink,FamilyTreeCareLink,FamilyTreePartnerEpisode
from app.schemas.family_tree import ParentData,CareData,PartnerData,chronology
from .access import person,scoped,error
from .serialization import record_dto
from . import people

RELATIONS={'parent-links':(FamilyTreeParentLink,ParentData,['parent_person_id','child_person_id']),'care-links':(FamilyTreeCareLink,CareData,['caregiver_person_id','recipient_person_id']),'partner-episodes':(FamilyTreePartnerEpisode,PartnerData,['person_a_id','person_b_id'])}

def check_cycle(session,household_id,parent,child,exclude=None):
    stmt=select(FamilyTreeParentLink.parent_person_id,FamilyTreeParentLink.child_person_id).where(FamilyTreeParentLink.household_id==household_id)
    if exclude: stmt=stmt.where(FamilyTreeParentLink.id!=exclude)
    edges=session.execute(stmt.limit(20001)).all()
    if len(edges)>20000: error('resource_limit','Relationship validation limit exceeded.',413)
    adjacency={}
    for a,b in edges: adjacency.setdefault(a,[]).append(b)
    stack=[child]; seen=set()
    while stack:
        node=stack.pop()
        if node==parent: error('relationship_cycle','This link would create an ancestry cycle.')
        if node not in seen:
            seen.add(node); stack.extend(adjacency.get(node,[]))

def change(session,actor,c,kind,data=None,rid=None,changes=None,remove=False):
    model,dto,endpoints=RELATIONS[kind]
    old=scoped(session,model,actor.household_id,rid) if rid else None
    if old is None:
        count=sum(session.scalar(select(func.count()).select_from(m).where(m.household_id==actor.household_id)) or 0 for m in [FamilyTreeParentLink,FamilyTreeCareLink,FamilyTreePartnerEpisode])
        if count>=20000:error('resource_limit','Collection relationship limit exceeded.',413)
    old_ids=[getattr(old,f) for f in endpoints] if old else []
    for pid in old_ids: person(session,actor.household_id,pid,editable=True)
    if remove:
        session.delete(old); return {'person_ids':old_ids,'relationship_ids':[old.id]},[]
    if changes is not None:
        patch=changes.model_dump(mode='json',exclude_unset=True)
        if not patch: error('validation_error','Empty patches are unsupported.',422)
        combined={k:v for k,v in record_dto(old).items() if k not in {'id','created_by_user_id'}}
        data=dto.model_validate({**combined,**patch})
    else:
        data=dto.model_validate(data.model_dump(mode='json',include=set(dto.model_fields)))
    values=data.model_dump(mode='json')
    a,b=[values[f] for f in endpoints]
    if a==b: error('validation_error','Relationship endpoints must differ.',422)
    for pid in [a,b]: person(session,actor.household_id,pid,editable=True)
    if kind=='parent-links': check_cycle(session,actor.household_id,a,b,rid)
    if kind=='partner-episodes': values['person_a_id'],values['person_b_id']=sorted([a,b])
    if old is not None:
        previous={k:v for k,v in record_dto(old).items() if k not in {'id','created_by_user_id'}}
        if values==previous:error('validation_error','This patch does not change any facts.',422)
    warnings=chronology(getattr(data,'start_date',None),getattr(data,'end_date',None))
    if kind=='partner-episodes':
        existing=session.scalar(select(model.id).where(model.household_id==actor.household_id,model.person_a_id==min(a,b),model.person_b_id==max(a,b),model.id!=(rid or 0)))
        if existing: warnings.append('similar_partner_episode')
    row=old or model(household_id=actor.household_id,collection_id=c.id,created_by_user_id=actor.id)
    row.kind=values.pop('kind')
    for f in endpoints: setattr(row,f,values.pop(f))
    row.facts=values
    session.add(row); session.flush()
    return {'person_ids':sorted(set(old_ids+[a,b])),'relationship_ids':[row.id]},warnings

def relative(session,actor,c,command):
    anchor=person(session,actor.household_id,command.anchor_person_id,editable=True)
    p,warnings=people.add(session,actor,c,command.person)
    rel=command.relationship.model_dump(mode='json'); direction=rel.pop('direction')
    if direction in {'parent','child'}:
        rel.pop('status'); rel.pop('start_date'); rel.pop('end_date')
        rel.update(parent_person_id=p.id if direction=='parent' else anchor.id,child_person_id=anchor.id if direction=='parent' else p.id)
        kind='parent-links'
    elif direction in {'caregiver','recipient'}:
        rel.pop('status'); rel.update(caregiver_person_id=p.id if direction=='caregiver' else anchor.id,recipient_person_id=anchor.id if direction=='caregiver' else p.id)
        kind='care-links'
    else:
        rel.update(person_a_id=anchor.id,person_b_id=p.id); kind='partner-episodes'
    affected,extra=change(session,actor,c,kind,data=RELATIONS[kind][1].model_validate(rel))
    return affected,warnings+extra
