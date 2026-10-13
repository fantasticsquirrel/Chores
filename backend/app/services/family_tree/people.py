from datetime import UTC,datetime
from sqlalchemy import select,delete,func,or_
from app.models import Household
from app.models.family_tree import FamilyTreePerson,FamilyTreePersonTag,FamilyTreeOtherName,FamilyTreeParentLink,FamilyTreeCareLink,FamilyTreePartnerEpisode
from app.schemas.family_tree import PersonCreate,chronology
from app.services.modules import ModuleService
from .access import authorize,collection,person,error
from .serialization import person_dto,record_dto,identity_dto
from .alias_provenance import local_marker


def state(session,actor):
    authorize(session,actor)
    c=collection(session,actor.household_id)
    base=select(func.count()).select_from(FamilyTreePerson).where(FamilyTreePerson.household_id==actor.household_id)
    manage=ModuleService().can_access_module(session,actor,'family-tree',manage=True)
    return {'state':'initialized' if c else 'uninitialized','collection_id':c.id if c else None,'title':c.title if c else 'Family Tree','graph_revision':c.revision if c else 0,'default_focus_person_id':c.default_focus_person_id if c else None,'active_people_count':session.scalar(base.where(FamilyTreePerson.archived_at.is_(None))) or 0,'archived_people_count':session.scalar(base.where(FamilyTreePerson.archived_at.is_not(None))) or 0,'capabilities':{'can_manage':manage,'can_export':manage,'can_purge':bool(manage and session.scalar(select(Household.owner_user_id).where(Household.id==actor.household_id))==actor.id)}}


def replace_tags(session,actor,c,p,tags):
    session.execute(delete(FamilyTreePersonTag).where(FamilyTreePersonTag.household_id==actor.household_id,FamilyTreePersonTag.person_id==p.id))
    for tag in sorted(set(t.casefold().strip() for t in tags)):
        session.add(FamilyTreePersonTag(household_id=actor.household_id,collection_id=c.id,person_id=p.id,tag=tag,created_by_user_id=actor.id))


def replace_aliases(session,actor,c,p,aliases):
    old=list(session.scalars(select(FamilyTreeOtherName).where(FamilyTreeOtherName.household_id==actor.household_id,FamilyTreeOtherName.person_id==p.id).order_by(FamilyTreeOtherName.position,FamilyTreeOtherName.id)))
    remaining=list(old)
    for position,alias in enumerate(aliases):
        row=next((r for r in remaining if r.name==alias.name and r.label==alias.label),None)
        if row is not None: remaining.remove(row)
        else:
            row=FamilyTreeOtherName(household_id=actor.household_id,collection_id=c.id,person_id=p.id,name=alias.name,label=alias.label,created_by_user_id=actor.id,portable_provenance=local_marker())
            session.add(row)
        row.position=position
    for row in remaining:session.delete(row)


def save_facts(p,data):
    facts=data.model_dump(mode='json',exclude={'tags'})
    p.facts=facts
    text=[facts.get(k) or '' for k in ['first_name','middle_name','last_name','maiden_name','suffix','display_name']]
    text.extend(a['name'] for a in facts['aliases'])
    p.search_text=' '.join(text).casefold()


def add(session,actor,c,data):
    if (session.scalar(select(func.count()).select_from(FamilyTreePerson).where(FamilyTreePerson.household_id==actor.household_id)) or 0)>=5000:
        error('resource_limit','Collection person limit exceeded.',413)
    data=PersonCreate.model_validate(data.model_dump(mode='json'))
    p=FamilyTreePerson(household_id=actor.household_id,collection_id=c.id,created_by_user_id=actor.id)
    save_facts(p,data); session.add(p); session.flush()
    replace_tags(session,actor,c,p,data.tags)
    replace_aliases(session,actor,c,p,data.aliases)
    if c.default_focus_person_id is None: c.default_focus_person_id=p.id
    return p,chronology(data.birth_date,data.death_date)


def edit(session,actor,c,pid,changes):
    p=person(session,actor.household_id,pid,editable=True)
    data=PersonCreate.model_validate({**p.facts,'tags':person_dto(session,p)['tags'],**changes.model_dump(mode='json',exclude_unset=True)})
    old={**p.facts,'tags':person_dto(session,p)['tags']}
    normalized=data.model_dump(mode='json')
    normalized['tags']=sorted(set(t.casefold() for t in data.tags))
    if normalized==old:error('validation_error','This patch does not change any facts.',422)
    save_facts(p,data)
    if 'tags' in changes.model_fields_set: replace_tags(session,actor,c,p,data.tags)
    if 'aliases' in changes.model_fields_set: replace_aliases(session,actor,c,p,data.aliases)
    return {'person_ids':[p.id]},chronology(data.birth_date,data.death_date)


def lifecycle(session,actor,c,pid,action,reason=None):
    p=person(session,actor.household_id,pid,editable=True,allow_locked=action in {'lock','unlock'})
    if action=='archive':
        if p.archived_at is not None:error('validation_error','This person is already archived.',422)
        p.archived_at=datetime.now(UTC)
        if c.default_focus_person_id==p.id: c.default_focus_person_id=None
    elif action=='restore':
        if p.archived_at is None:error('validation_error','This person is not archived.',422)
        p.archived_at=None
        if c.default_focus_person_id is None: c.default_focus_person_id=p.id
    elif action=='lock':
        if p.is_locked: error('person_locked','This person is already locked.')
        p.is_locked=True; p.lock_reason=reason; p.locked_by_user_id=actor.id; p.locked_at=datetime.now(UTC)
    elif action=='unlock':
        if not p.is_locked: error('validation_error','This person is not locked.',422)
        p.is_locked=False; p.lock_reason=None; p.locked_by_user_id=None; p.locked_at=None
    p.updated_at=datetime.now(UTC)
    return {'person_ids':[p.id]},[]


def directory(session,actor,query='',tag=None,living_status=None,archived=False,cursor=None,limit=50):
    authorize(session,actor)
    c=collection(session,actor.household_id)
    stmt=select(FamilyTreePerson).where(FamilyTreePerson.household_id==actor.household_id)
    stmt=stmt.where(FamilyTreePerson.archived_at.is_not(None) if archived else FamilyTreePerson.archived_at.is_(None))
    if query:
        escaped=query.casefold().replace('\\','\\\\').replace('%','\\%').replace('_','\\_')
        stmt=stmt.where(FamilyTreePerson.search_text.like('%'+escaped+'%',escape='\\'))
    if tag:
        stmt=stmt.where(FamilyTreePerson.id.in_(select(FamilyTreePersonTag.person_id).where(FamilyTreePersonTag.household_id==actor.household_id,FamilyTreePersonTag.tag==tag.casefold())))
    if living_status: stmt=stmt.where(FamilyTreePerson.facts['living_status'].as_string()==living_status)
    total=session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    if cursor: stmt=stmt.where(FamilyTreePerson.id>cursor)
    rows=list(session.scalars(stmt.order_by(FamilyTreePerson.id).limit(limit+1)))
    return {'graph_revision':c.revision if c else 0,'items':[person_dto(session,p) for p in rows[:limit]],'total':total,'next_cursor':rows[limit-1].id if len(rows)>limit else None}


def detail(session,actor,pid):
    authorize(session,actor)
    p=person(session,actor.household_id,pid); c=collection(session,actor.household_id)
    result={'graph_revision':c.revision,'person':person_dto(session,p),'canonical_person':person_dto(session,person(session,actor.household_id,p.merged_into_person_id)) if p.merged_into_person_id else None,'identity_link':identity_dto(session,p)}
    for model,fields,key in [(FamilyTreeParentLink,['parent_person_id','child_person_id'],'parent_links'),(FamilyTreeCareLink,['caregiver_person_id','recipient_person_id'],'care_links'),(FamilyTreePartnerEpisode,['person_a_id','person_b_id'],'partner_episodes')]:
        rows=list(session.scalars(select(model).where(model.household_id==actor.household_id,or_(*(getattr(model,f)==pid for f in fields))).order_by(model.id).limit(501)))
        if len(rows)>500: error('resource_limit','Use the bounded graph projection for this dense person.',413)
        result[key]=[record_dto(row) for row in rows]
    return result
