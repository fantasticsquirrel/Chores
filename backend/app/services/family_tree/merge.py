"""Previewed one-transaction merge with attribution and flat-alias maintenance."""
from datetime import UTC, datetime
from sqlalchemy import select, update
from pydantic import ValidationError
from app.models.family_tree import FamilyTreePerson as Person, FamilyTreeParentLink as Parent, FamilyTreeCareLink as Care, FamilyTreePartnerEpisode as Partner, FamilyTreeStory as Story, FamilyTreeResidence as Residence, FamilyTreePersonTag as Tag, FamilyTreeOtherName as Name, FamilyTreeIdentityLink as Identity, FamilyTreeMediaReference as Reference, FamilyTreeImportSourceKey as Source
from app.schemas.family_tree import PersonCreate, chronology
from app.schemas.family_tree_transfer import MergePreview
from .access import authorize, person, error
from .serialization import person_dto
from . import jobs, people

RELATIONS = [(Parent, ('parent_person_id','child_person_id')), (Care, ('caregiver_person_id','recipient_person_id')), (Partner, ('person_a_id','person_b_id'))]


def acyclic(edges):
    adjacency={}; indegree={}
    for a,b in edges:
        if a==b: error('merge_conflict', 'A merge cannot create self relationships.')
        adjacency.setdefault(a,[]).append(b)
        indegree[b]=indegree.get(b,0)+1
        indegree.setdefault(a,0)
    todo=[k for k,v in indegree.items() if not v]; visited=0
    while todo:
        a=todo.pop(); visited+=1
        for b in adjacency.get(a,[]):
            indegree[b]-=1
            if not indegree[b]: todo.append(b)
    if visited!=len(indegree): error('relationship_cycle', 'The resulting ancestry would contain a cycle.')


def plan(session, actor, body):
    source = person(session, actor.household_id, body.source_person_id, editable=True)
    target = person(session, actor.household_id, body.target_person_id, editable=True)
    if source.id==target.id: error('merge_conflict', 'Choose distinct source and target people.')
    scalar = set(PersonCreate.model_fields)-{'tags','aliases'}
    if set(body.scalar_choices)-scalar: error('validation_error', 'Unsupported scalar choice.', 422)
    conflicts = [k for k in sorted(scalar) if source.facts.get(k) is not None and target.facts.get(k) is not None and source.facts.get(k)!=target.facts.get(k)]
    missing = sorted(set(conflicts)-set(body.scalar_choices))
    combined = dict(target.facts)
    for k in scalar:
        if body.scalar_choices.get(k)=='source' or (k not in body.scalar_choices and target.facts.get(k) is None):
            combined[k]=source.facts.get(k)
    # Decisions validate the complete scalar state before the preview is usable.
    data = PersonCreate.model_validate(combined)
    identities = list(session.scalars(select(Identity).where(Identity.household_id==actor.household_id, Identity.person_id.in_([source.id,target.id]))))
    if len(identities)>1:
        error('identity_link_conflict', 'Correct distinct identity links before merging.')
    changes=[]; parent_edges=[]; seen_parent={}; partner_signatures={}; similar=[]
    for model, endpoints in RELATIONS:
        rows = list(session.scalars(select(model).where(model.household_id==actor.household_id).order_by(model.id).limit(20001)))
        if len(rows)>20000: error('resource_limit', 'Merge validation limit exceeded.', 413)
        for row in rows:
            old=[getattr(row,k) for k in endpoints]
            new=[target.id if v==source.id else v for v in old]
            if new[0]==new[1]: error('merge_conflict', 'Remove self-producing relationship facts before merging.')
            if model is Partner: new.sort()
            if old!=new:
                for endpoint in set(old):
                    person(session, actor.household_id, endpoint, editable=True)
                changes.append({'table':model.__tablename__,'id':row.id,'endpoints':new})
            if model is Parent:
                signature=(*new,row.kind)
                if signature in seen_parent:
                    # No destructive deduplication or source-attribution loss.
                    error('merge_conflict', 'Resolve duplicate parent facts before merging.')
                seen_parent[signature]=row.id
                parent_edges.append(tuple(new))
            if model is Partner:
                signature=(*new,row.kind)
                if signature in partner_signatures and (source.id in old or partner_signatures[signature][1]):
                    similar.append(row.id)
                partner_signatures[signature]=(row.id,source.id in old)
    acyclic(parent_edges)
    aliases=list(session.scalars(select(Person.id).where(Person.household_id==actor.household_id, Person.merged_into_person_id==source.id).order_by(Person.id)))
    counts={}
    for label, model in [('stories',Story),('residences',Residence),('tags',Tag),('names',Name),('media_references',Reference)]:
        counts[label]=len(list(session.scalars(select(model.id).where(model.household_id==actor.household_id,model.person_id==source.id))))
    return source,target,data,{'source':person_dto(session,source),'target':person_dto(session,target),'conflicting_fields':conflicts,
        'unresolved_fields':missing,'relationship_changes':changes,'retained_records':counts,'retargeted_alias_ids':aliases,
        'similar_partner_episode_ids':similar,'requires_partner_review':bool(similar and not body.retain_similar_partner_episodes),
        'warnings':chronology(data.birth_date,data.death_date)}


def preview(session, actor, body):
    authorize(session, actor, manage=True); jobs.revision(session, actor, body.expected_graph_revision)
    try: _,_,_,summary=plan(session,actor,body)
    except (ValidationError,ValueError): error('merge_conflict','The chosen scalar facts cannot form a valid person.')
    row=jobs.create(session,actor,'merge',body.expected_graph_revision,body.model_dump(mode='json'),summary,seconds=900)
    return jobs.dto(row,preview=True)


def commit(session, actor, c, body):
    job=jobs.get(session,actor,'merge',token=body.preview_token)
    if job.expected_revision!=body.expected_graph_revision: error('revision_conflict','Preview revision does not match.')
    original=MergePreview.model_validate(job.payload)
    source,target,data,summary=plan(session,actor,original)
    if summary['unresolved_fields'] or summary['requires_partner_review']:
        error('merge_conflict','Resolve scalar choices and explicitly review similar partnership episodes.')
    # Retarget existing aliases BEFORE making source an alias: flat trigger.
    session.execute(update(Person).where(Person.household_id==actor.household_id,Person.merged_into_person_id==source.id).values(merged_into_person_id=target.id))
    session.flush()
    for model,endpoints in RELATIONS:
        for change in summary['relationship_changes']:
            if change['table']==model.__tablename__:
                row=session.get(model,change['id'])
                for k,v in zip(endpoints,change['endpoints']): setattr(row,k,v)
    session.flush()
    # Story composite reference FK requires removing/recreating only the
    # attachment link during its parent move; immutable bytes remain retained.
    source_refs=list(session.scalars(select(Reference).where(Reference.household_id==actor.household_id,Reference.person_id==source.id)))
    refs=[{k:getattr(r,k) for k in ['asset_id','story_id','role','created_by_user_id','created_at']} for r in source_refs]
    for r in source_refs: session.delete(r)
    session.flush()
    max_position=max([0,*session.scalars(select(Story.position).where(Story.household_id==actor.household_id,Story.person_id==target.id))])
    stories=list(session.scalars(select(Story).where(Story.household_id==actor.household_id,Story.person_id==source.id).order_by(Story.position,Story.id)))
    for i,row in enumerate(stories): row.person_id=target.id; row.position=max_position+1+i
    target_primary=session.scalar(select(Residence.id).where(Residence.household_id==actor.household_id,Residence.person_id==target.id,Residence.is_primary.is_(True)))
    for row in session.scalars(select(Residence).where(Residence.household_id==actor.household_id,Residence.person_id==source.id)):
        if target_primary: row.is_primary=False
        row.person_id=target.id
    session.flush()
    primary=session.scalar(select(Reference.id).where(Reference.household_id==actor.household_id,Reference.person_id==target.id,Reference.role=='primary'))
    for values in refs:
        if values['role']=='primary' and primary: values['role']='gallery'
        existing=session.scalar(select(Reference.id).where(Reference.household_id==actor.household_id,Reference.person_id==target.id,Reference.asset_id==values['asset_id'],Reference.story_id==values['story_id'],Reference.role==values['role']))
        if not existing: session.add(Reference(household_id=actor.household_id,collection_id=c.id,person_id=target.id,**values))
    target_tags=set(session.scalars(select(Tag.tag).where(Tag.household_id==actor.household_id,Tag.person_id==target.id)))
    for row in session.scalars(select(Tag).where(Tag.household_id==actor.household_id,Tag.person_id==source.id)):
        if row.tag in target_tags: session.delete(row)
        else: row.person_id=target.id; target_tags.add(row.tag)
    for row in session.scalars(select(Name).where(Name.household_id==actor.household_id,Name.person_id==source.id)):
        # Preserve an alias's obsolete entered-name copy, including people
        # whose only name is an other-name, while retaining target attribution.
        session.add(Name(household_id=actor.household_id,collection_id=c.id,person_id=target.id,
            name=row.name,label=row.label,position=row.position,created_by_user_id=row.created_by_user_id,created_at=row.created_at))
    for link in session.scalars(select(Identity).where(Identity.household_id==actor.household_id,Identity.person_id==source.id)):
        link.person_id=target.id
    # Move record provenance independently of the alias's obsolete scalar copy,
    # so explicit alias purge cannot erase attribution of retained target facts.
    source_provenance=session.scalar(select(Source).where(Source.household_id==actor.household_id,Source.person_id==source.id))
    if source_provenance and source_provenance.provenance.get('records'):
        target_provenance=session.scalar(select(Source).where(Source.household_id==actor.household_id,Source.person_id==target.id))
        if target_provenance is None:
            target_provenance=Source(household_id=actor.household_id,collection_id=c.id,person_id=target.id,created_by_user_id=actor.id,
                source_key=f'merge:{target.id}',package_digest=source_provenance.package_digest,
                provenance={'person':{'created_at':target.created_at.isoformat(),'attribution':'Household contributor'},'records':{}})
            session.add(target_provenance)
        retained={group:dict(records) for group,records in target_provenance.provenance.get('records',{}).items()}
        for group,records in source_provenance.provenance['records'].items(): retained.setdefault(group,{}).update(records)
        target_provenance.provenance={**target_provenance.provenance,'records':retained}
        source_provenance.provenance={**source_provenance.provenance,'records':{}}
    session.flush()
    names=list(session.scalars(select(Name).where(Name.household_id==actor.household_id,Name.person_id==target.id).order_by(Name.position,Name.id)))
    data=PersonCreate.model_validate({**data.model_dump(mode='json'),'aliases':[{'name':n.name,'label':n.label} for n in names]})
    people.save_facts(target,data)
    if c.default_focus_person_id==source.id: c.default_focus_person_id=target.id
    source.archived_at=datetime.now(UTC); source.merged_into_person_id=target.id
    session.flush(); jobs.consume(job)
    return {'person_ids':[source.id,target.id,*summary['retargeted_alias_ids']]}, summary['warnings']
