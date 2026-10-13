"""Owner/manage/fresh-password purge; aliases are individually removable."""
from sqlalchemy import select, or_
from fastapi import HTTPException
from app.models import Household
from app.models.family_tree import FamilyTreePerson as Person, FamilyTreeStory, FamilyTreeResidence, FamilyTreeMediaReference, FamilyTreeParentLink, FamilyTreeCareLink, FamilyTreePartnerEpisode
from app.security.passwords import verify_password
from .access import authorize, person, error
from . import jobs


def owner(session, actor, password):
    actor=authorize(session,actor,manage=True)
    household=session.get(Household,actor.household_id, populate_existing=True)
    if household is None or household.owner_user_id!=actor.id:
        raise HTTPException(403,'Household owner authority is required.')
    if not verify_password(password,actor.password_hash):
        raise HTTPException(403,'Password confirmation failed.')
    return actor


def check(session,actor,pid):
    p=person(session,actor.household_id,pid)
    if p.is_locked: error('person_locked','Unlock this person before purging.')
    aliases=list(session.scalars(select(Person.id).where(Person.household_id==actor.household_id,Person.merged_into_person_id==p.id).order_by(Person.id)))
    if aliases: error('merge_aliases_present','Purge the referring aliases individually before obtaining a new target preview.',blocking_alias_ids=aliases)
    # Cascaded association deletion is a relationship mutation. Ownership and
    # password confirmation cannot override a neighbour's durable edit lock.
    for model,fields in [(FamilyTreeParentLink,('parent_person_id','child_person_id')), (FamilyTreeCareLink,('caregiver_person_id','recipient_person_id')), (FamilyTreePartnerEpisode,('person_a_id','person_b_id'))]:
        rows=list(session.scalars(select(model).where(model.household_id==actor.household_id,or_(*(getattr(model,field)==pid for field in fields))).limit(20001)))
        if len(rows)>20000: error('resource_limit','Purge relationship inventory exceeds the permitted bound.',413)
        for row in rows:
            for field in fields:
                endpoint=person(session,actor.household_id,getattr(row,field))
                if endpoint.is_locked: error('person_locked','Unlock all affected people before purging relationship facts.')
    return p


def preview(session,actor,pid,body):
    owner(session,actor,body.password); jobs.revision(session,actor,body.expected_graph_revision)
    p=check(session,actor,pid)
    summary={'person_id':p.id,'alias_only':p.merged_into_person_id is not None,'retained_backup_policy':'Older operator backups and already generated exports retain their immutable snapshots until their configured retention expires.'}
    for name,model in [('stories',FamilyTreeStory),('residences',FamilyTreeResidence),('media_references',FamilyTreeMediaReference)]:
        summary[name]=len(list(session.scalars(select(model.id).where(model.household_id==actor.household_id,model.person_id==pid))))
    row=jobs.create(session,actor,'purge',body.expected_graph_revision,{'person_id':pid},summary,seconds=900)
    return jobs.dto(row,preview=True)


def commit(session,actor,c,pid,body):
    owner(session,actor,body.password)
    job=jobs.get(session,actor,'purge',token=body.preview_token)
    if job.payload.get('person_id')!=pid or job.expected_revision!=body.expected_graph_revision:
        error('revision_conflict','Preview does not match this person or revision.')
    p=check(session,actor,pid)
    if c.default_focus_person_id==p.id:
        c.default_focus_person_id=None; session.flush()
    # Database cascades remove only this person's rows. Media cleanup separately
    # claims unreferenced/unpinned assets; snapshots remain immutable.
    session.delete(p); session.flush(); jobs.consume(job)
    return {'person_ids':[pid]}, []
