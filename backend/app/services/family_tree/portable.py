"""Portable version-1 snapshots and whole-package validation (no DB files)."""
from datetime import UTC, datetime
import json
from sqlalchemy import select
from pydantic import ValidationError
from app.models.family_tree import FamilyTreePerson as Person, FamilyTreeParentLink as Parent, FamilyTreeCareLink as Care, FamilyTreePartnerEpisode as Partner, FamilyTreeStory as Story, FamilyTreeResidence as Residence, FamilyTreeMediaAsset as Asset, FamilyTreeMediaReference as Reference, FamilyTreeImportSourceKey as Source
from app.schemas.family_tree_transfer import Manifest
from app.schemas.family_tree import chronology, PersonCreate
from .access import error, collection
from .serialization import person_dto
from . import alias_provenance, storage
from .merge import acyclic


def check_counts(value):
    if not isinstance(value,(dict,Manifest)): return
    limits = storage.collection_limits()
    def count(key):
        rows = value.get(key, []) if isinstance(value, dict) else getattr(value, key)
        return len(rows) if isinstance(rows, list) else 0
    sizes = {'people':count('people'), 'facts':sum(count(k) for k in ('parent_links','care_links','partner_episodes')),
             'records':count('stories')+count('residences'), 'media':count('media'), 'references':count('media_references')}
    if any(sizes[k] > limits[k] for k in limits):
        error('resource_limit','Logical package exceeds collection limits.',413)


def decode(data):
    if len(data) > storage.manifest_limit():
        error('resource_limit','Manifest exceeds the permitted size.',413)
    def unique(pairs):
        result={}
        for k,v in pairs:
            if k in result: raise ValueError('Duplicate JSON key')
            result[k]=v
        return result
    try:
        value=json.loads(data,object_pairs_hook=unique,parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Non-finite JSON')))
        check_counts(value)
        return Manifest.model_validate(value,strict=True)
    except (ValidationError, ValueError, UnicodeError, RecursionError):
        error('validation_error','Invalid or unsupported logical Family Tree manifest.',422)


def encode(manifest):
    return json.dumps(manifest.model_dump(mode='json'),sort_keys=True,separators=(',',':'),ensure_ascii=False).encode('utf8')


def validate(manifest):
    check_counts(manifest)
    groups=['people','parent_links','care_links','partner_episodes','stories','residences','media','media_references']
    keys=set()
    for group in groups:
        for row in getattr(manifest,group):
            if row.key in keys: error('validation_error','Source keys must be unique across the entire package.',422)
            keys.add(row.key)
    if sum(len(getattr(manifest,k)) for k in ['parent_links','care_links','partner_episodes'])>20000 or len(manifest.stories)+len(manifest.residences)>40000:
        error('resource_limit','Logical package exceeds collection limits.',413)
    people={p.key:p for p in manifest.people}; assets={a.key:a for a in manifest.media}; stories={s.key:s for s in manifest.stories}
    if manifest.default_focus_key is not None and manifest.default_focus_key not in people: error('validation_error','Invalid focus reference.',422)
    for p in people.values():
        if p.merged_into_key:
            if p.is_locked:
                error('validation_error','Merged aliases cannot carry an edit lock; their alias status already prevents ordinary editing.',422)
            target=people.get(p.merged_into_key)
            if not p.archived or target is None or target.merged_into_key or target.key==p.key:
                error('validation_error','Merged aliases must be archived and flat.',422)
    warnings=set(); edges=[]; seen_parent=set(); primaries=set(); primary_images=set(); seen_refs=set()
    def canonical(key):
        if key not in people or people[key].merged_into_key:
            error('validation_error','Record endpoints must be canonical people in this package.',422)
    for p in manifest.people: warnings.update(chronology(p.person.birth_date,p.person.death_date))
    for group, fields in [('parent_links',('parent_key','child_key')),('care_links',('caregiver_key','recipient_key')),('partner_episodes',('person_a_key','person_b_key'))]:
        for r in getattr(manifest,group):
            a,b=[getattr(r,k) for k in fields]
            canonical(a); canonical(b)
            if a==b: error('validation_error','Relationship endpoints must differ.',422)
            if group=='parent_links':
                signature=(a,b,r.kind)
                if signature in seen_parent: error('validation_error','Duplicate parent fact.',422)
                seen_parent.add(signature); edges.append((a,b))
            else: warnings.update(chronology(r.start_date,r.end_date))
    acyclic(edges)
    for s in manifest.stories: canonical(s.person_key)
    for r in manifest.residences:
        canonical(r.person_key); warnings.update(chronology(r.residence.start_date,r.residence.end_date))
        if r.residence.is_primary:
            if r.person_key in primaries: error('validation_error','Multiple primary residences.',422)
            primaries.add(r.person_key)
    paths=set()
    for asset in manifest.media:
        if asset.path in paths: error('validation_error','Duplicate media paths.',422)
        paths.add(asset.path)
    for r in manifest.media_references:
        canonical(r.person_key)
        if r.asset_key not in assets or ((r.role=='story') != (r.story_key is not None)):
            error('validation_error','Invalid media reference.',422)
        if r.story_key and (r.story_key not in stories or stories[r.story_key].person_key!=r.person_key):
            error('validation_error','Story image belongs to a different person.',422)
        signature=(r.asset_key,r.person_key,r.story_key,r.role)
        if signature in seen_refs: error('validation_error','Duplicate image attachment.',422)
        seen_refs.add(signature)
        if r.role=='primary':
            if r.person_key in primary_images: error('validation_error','Multiple primary images.',422)
            primary_images.add(r.person_key)
    return sorted(warnings)


def snapshot(session,actor,metadata_only=False):
    c=collection(session,actor.household_id)
    bounds=storage.collection_limits()
    from sqlalchemy import func
    for models, key in [([Person],'people'),([Parent,Care,Partner],'facts'),([Story,Residence],'records'),([Reference],'references')]:
        total=sum(session.scalar(select(func.count()).select_from(model).where(model.household_id==actor.household_id)) or 0 for model in models)
        if total>bounds[key]: error('resource_limit','Snapshot exceeds its logical bound.',413)
    def rows(model, ceiling):
        values=list(session.scalars(select(model).where(model.household_id==actor.household_id).order_by(model.id).limit(ceiling+1)))
        if len(values)>ceiling: error('resource_limit','Snapshot exceeds its logical bound.',413)
        return values
    provenance={}
    for source in rows(Source,5000):
        provenance[('people',source.person_id)]=source.provenance.get('person',{})
        for group,records in source.provenance.get('records',{}).items():
            for key,value in records.items(): provenance[(group,int(key))]=value
    def prov(group,row):
        return provenance.get((group,row.id),{'created_at':row.created_at.isoformat(),'attribution':'Household contributor' if row.created_by_user_id is not None else None})
    people=[]
    contributors={}
    for p in rows(Person,5000):
        facts=person_dto(session,p)
        person={k:facts[k] for k in PersonCreate.model_fields}
        person['aliases']=alias_provenance.export_aliases(session,p,contributors)
        people.append({'key':f'p:{p.id}','person':person,'is_locked':p.is_locked,'lock_reason':p.lock_reason,'archived':p.archived_at is not None,
            'merged_into_key':f'p:{p.merged_into_person_id}' if p.merged_into_person_id else None,'provenance':prov('people',p)})
    result={'schema_version':1,'producer':'Family Manager/1','exported_at':datetime.now(UTC).isoformat(),
        'collection_title':c.title if c else 'Family Tree','snapshot_revision':c.revision if c else 0,
        'default_focus_key':f'p:{c.default_focus_person_id}' if c and c.default_focus_person_id else None,'media_omitted':metadata_only,'people':people}
    for group,model,endpoints in [('parent_links',Parent,{'parent_person_id':'parent_key','child_person_id':'child_key'}),('care_links',Care,{'caregiver_person_id':'caregiver_key','recipient_person_id':'recipient_key'}),('partner_episodes',Partner,{'person_a_id':'person_a_key','person_b_id':'person_b_key'})]:
        result[group]=[{**r.facts,'key':f'{group}:{r.id}','kind':r.kind,**{portable:f'p:{getattr(r,local)}' for local,portable in endpoints.items()},'provenance':prov(group,r)} for r in rows(model,20000)]
    result['stories']=[{'key':f's:{r.id}','person_key':f'p:{r.person_id}','story':r.facts,'position':r.position,'provenance':prov('stories',r)} for r in rows(Story,40000)]
    result['residences']=[{'key':f'r:{r.id}','person_key':f'p:{r.person_id}','residence':{**r.facts,'is_primary':r.is_primary},'provenance':prov('residences',r)} for r in rows(Residence,40000)]
    references=rows(Reference,40000)
    asset_ids=sorted({r.asset_id for r in references})
    if len(asset_ids)>bounds['media']: error('resource_limit','Snapshot media limit exceeded.',413)
    assets=list(session.scalars(select(Asset).where(Asset.household_id==actor.household_id,Asset.id.in_(asset_ids)).order_by(Asset.id))) if asset_ids else []
    if any(a.state!='ready' for a in assets): error('media_unavailable','Snapshot includes unavailable media.')
    extensions={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}
    result['media']=[{'key':f'm:{a.id}','path':f'media/{a.object_key}.{extensions[a.mime_type]}','mime_type':a.mime_type,'checksum':a.checksum,'byte_size':a.byte_size,'caption':a.caption} for a in assets]
    result['media_references']=[{'key':f'mr:{r.id}','asset_key':f'm:{r.asset_id}','person_key':f'p:{r.person_id}','story_key':f's:{r.story_id}' if r.story_id else None,'role':r.role} for r in references]
    check_counts(result)
    manifest=Manifest.model_validate(result)
    validate(manifest)
    return manifest, assets
