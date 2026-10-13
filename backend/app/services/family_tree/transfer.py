"""Bounded staged append imports and consistent pinned logical exports.

Synchronous bounded workers execute one job per request; no unbounded queues or
ZIP extraction. Up to 100MiB compressed/250MiB expanded/16MiB manifest, 1000
media, 5000 people, 20000 relations, 40000 records. Images decode individually
outside the graph write transaction. Retained ready jobs are actor-quota limited.
"""
from datetime import UTC, datetime, timedelta
import io
import json
import os
import secrets
import stat
import time
import zipfile
from pathlib import PurePosixPath
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select, update, delete, func
from app.models.family_tree import FamilyTreeCollection as Collection, FamilyTreePerson as Person, FamilyTreeParentLink as Parent, FamilyTreeCareLink as Care, FamilyTreePartnerEpisode as Partner, FamilyTreeStory as Story, FamilyTreeResidence as Residence, FamilyTreeMediaAsset as Asset, FamilyTreeMediaReference as Reference, FamilyTreeMediaPin as Pin, FamilyTreeImportSourceKey as Source
from app.schemas.family_tree_transfer import Manifest
from app.schemas.family_tree import PersonCreate
from .access import authorize, collection, error
from . import jobs, media, portable, storage, people


def _consistent_write_snapshot(session, actor):
    # Serialize snapshot inventory+pin creation against all graph writes and
    # deletion claims without incrementing the graph revision.
    c=collection(session,actor.household_id)
    if c:
        session.execute(update(Collection).where(Collection.id==c.id).values(revision=Collection.revision))
        session.refresh(c)
    else:
        connection=session.connection()
        if not connection.connection.driver_connection.in_transaction:
            connection.exec_driver_sql('BEGIN IMMEDIATE')
    authorize(session,actor,manage=True)
    return c


def export(session,actor,body):
    authorize(session,actor,manage=True)
    with storage.lock():
        _consistent_write_snapshot(session,actor)
        try: manifest,assets=portable.snapshot(session,actor,metadata_only=body.format=='json')
        except (ValidationError,ValueError): error('validation_error','Stored facts cannot form a valid portable snapshot.',422)
        encoded=portable.encode(manifest)
        if len(encoded)>storage.MAX_MANIFEST: error('resource_limit','Logical manifest exceeds the permitted size.',413)
        total=sum(a.byte_size for a in assets)+len(encoded)
        if total>storage.MAX_EXPANDED: error('resource_limit','Snapshot exceeds the expanded archive limit.',413)
        job=jobs.create(session,actor,'export',manifest.snapshot_revision,{'format':body.format},
            {'format':body.format,'people':len(manifest.people),'media':len(assets),'media_omitted':manifest.media_omitted})
        for a in assets:
            media.pin(session,a,job.token,'export',job.expires_at)
        session.commit()
        artifact_key=None
        try:
            # Build privately after SQL snapshot and pins are committed.
            if body.format=='json': artifact_key=storage.write(encoded,'artifacts')
            else:
                artifact_key=secrets.token_hex(32)
                fd=os.open(storage.path(artifact_key,'artifacts'),os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
                with os.fdopen(fd,'wb') as output:
                    with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED) as archive:
                        archive.writestr('manifest.json',encoded)
                        for descriptor,a in zip(manifest.media,assets):
                            data=storage.read(a.object_key)
                            if len(data)!=a.byte_size or storage.checksum(data)!=a.checksum:
                                error('media_unavailable','Snapshot media failed checksum verification.')
                            archive.writestr(descriptor.path,data)
                    output.flush(); os.fsync(output.fileno())
            artifact_limit=storage.limit('IMPORT_MAX_BYTES',storage.MAX_INPUT) if body.format=='zip' else storage.MAX_MANIFEST
            if storage.path(artifact_key,'artifacts').stat().st_size>artifact_limit:
                error('resource_limit','Complete export exceeds the portable input bound. Use an operator recovery backup.',413)
            with storage.open_read(artifact_key,'artifacts') as artifact:
                digest=storage.file_checksum(artifact)
            directory_fd=os.open(storage.root()/'artifacts',os.O_RDONLY|os.O_DIRECTORY)
            try: os.fsync(directory_fd)
            finally: os.close(directory_fd)
            authorize(session,actor,manage=True)
            job.artifact_key=artifact_key; job.artifact_checksum=digest
            session.commit()
            return jobs.dto(job)
        except BaseException:
            session.rollback()
            job=session.get(type(job),job.id); job.state='failed'; job.payload={}
            session.execute(delete(Pin).where(Pin.token==job.token)); session.commit()
            if artifact_key: storage.unlink(artifact_key,'artifacts')
            raise


def download(session,actor,job_id):
    with storage.lock():
        job=jobs.get(session,actor,'export',job_id=job_id)
        if not job.artifact_key: error('media_unavailable','The export artifact is unavailable.')
        stream=storage.open_read(job.artifact_key,'artifacts')
        try:
            if os.fstat(stream.fileno()).st_size>storage.MAX_EXPANDED+1024*1024 or storage.file_checksum(stream)!=job.artifact_checksum:
                error('media_unavailable','Export integrity verification failed.')
            stream.seek(0)
            # Open immutable descriptor remains valid if TTL cleanup unlinks its
            # path while the authorized response is streaming on this host.
            return stream,job.payload['format']
        except BaseException:
            stream.close(); raise


def _zip_manifest(path):
    archive=zipfile.ZipFile(path,'r')
    try:
        entries=archive.infolist()
        if len(entries)>1001: error('resource_limit','Archive entry limit exceeded.',413)
        names=set(); expanded=0
        for entry in entries:
            name=entry.filename
            p=PurePosixPath(name)
            if '\\' in name or '\x00' in name or p.is_absolute() or any(part in {'..','.'} for part in p.parts) or str(p)!=name or name in names or entry.is_dir():
                error('validation_error','Unsafe or duplicate archive path.',422)
            mode=entry.external_attr>>16
            if stat.S_ISLNK(mode) or (stat.S_IFMT(mode) and not stat.S_ISREG(mode)) or entry.flag_bits & 1 or entry.compress_type not in {zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED}:
                error('validation_error','Unsupported archive entry structure.',422)
            names.add(name); expanded+=entry.file_size
            if expanded>storage.limit('IMPORT_MAX_EXPANDED_BYTES',storage.MAX_EXPANDED): error('resource_limit','Expanded archive size exceeded.',413)
        if 'manifest.json' not in names: error('validation_error','Archive manifest is missing.',422)
        info=archive.getinfo('manifest.json')
        if info.file_size>storage.MAX_MANIFEST: error('resource_limit','Manifest exceeds the permitted size.',413)
        with archive.open(info) as stream: data=stream.read(storage.MAX_MANIFEST+1)
        manifest=portable.decode(data)
        expected={'manifest.json',*(m.path for m in manifest.media)}
        if names!=expected: error('validation_error','Archive inventory differs from the logical manifest.',422)
        if manifest.media_omitted and manifest.media: error('validation_error','A ZIP must contain its declared media.',422)
        return archive,manifest
    except BaseException:
        archive.close(); raise


def stage_import(session,actor,stage_key,expected):
    authorize(session,actor,manage=True); jobs.revision(session,actor,expected)
    archive=None; staged=[]
    deadline=time.monotonic()+storage.limit('TRANSFER_SECONDS',120)
    try:
        path=storage.path(stage_key,'staging')
        with path.open('rb') as source: signature=source.read(4)
        if signature.startswith(b'PK'):
            archive,manifest=_zip_manifest(path)
        else:
            manifest=portable.decode(storage.read(stage_key,'staging',storage.MAX_MANIFEST))
            if manifest.media and not manifest.media_omitted:
                error('validation_error','Self-contained media requires a ZIP bundle.',422)
        warnings=portable.validate(manifest)
        # Preview import counts against current target before publishing files.
        capacity(session,actor,manifest)
        media_map={}
        if archive:
            for descriptor in manifest.media:
                if time.monotonic()>deadline: error('resource_limit','Import validation exceeded its processing budget.',413)
                info=archive.getinfo(descriptor.path)
                if info.file_size!=descriptor.byte_size: error('validation_error','Media size does not match inventory.',422)
                with archive.open(info) as source: data=source.read(storage.MAX_IMAGE+1)
                if len(data)!=descriptor.byte_size or storage.checksum(data)!=descriptor.checksum:
                    error('validation_error','Media checksum does not match inventory.',422)
                clean,mime,width,height=media.sanitize(data,descriptor.mime_type)
                key=storage.write(clean,'artifacts'); staged.append(key)
                media_map[descriptor.key]={'key':key,'mime':mime,'width':width,'height':height,'checksum':storage.checksum(clean)}
        if time.monotonic()>deadline: error('resource_limit','Import validation exceeded its processing budget.',413)
        encoded=portable.encode(manifest)
        if len(encoded)>storage.MAX_MANIFEST: error('resource_limit','Normalized logical manifest exceeds the permitted size.',413)
        digest=storage.checksum(encoded)
        duplicate=bool(session.scalar(select(Source.id).where(Source.household_id==actor.household_id,Source.package_digest==digest).limit(1)))
        local_names=list(session.execute(select(Person.id,Person.search_text).where(Person.household_id==actor.household_id).limit(5001)))
        suggestions=[]
        for p in manifest.people:
            name=(p.person.display_name or ' '.join(x for x in [p.person.first_name,p.person.last_name] if x)).casefold()
            matches=[pid for pid,text in local_names if name and name in text]
            if matches and len(suggestions)<100: suggestions.append({'source_key':p.key,'candidate_person_ids':matches[:20]})
        summary={'people':len(manifest.people),'relationships':len(manifest.parent_links)+len(manifest.care_links)+len(manifest.partner_episodes),
            'stories':len(manifest.stories),'residences':len(manifest.residences),'media':len(media_map),'missing_media':len(manifest.media)-len(media_map),
            'warnings':warnings,'duplicate_provenance':duplicate,'duplicate_suggestions':suggestions,'unsupported_fields':[]}
        row=jobs.create(session,actor,'import',expected,{'manifest':manifest.model_dump(mode='json'),'media':media_map,'digest':digest},summary)
        session.commit()
        return jobs.dto(row)
    except (zipfile.BadZipFile, RuntimeError, OSError, EOFError):
        session.rollback()
        for key in staged: storage.unlink(key,'artifacts')
        error('validation_error','Invalid logical import archive.',422)
    except BaseException:
        session.rollback()
        for key in staged: storage.unlink(key,'artifacts')
        raise
    finally:
        if archive: archive.close()
        storage.unlink(stage_key,'staging')


def capacity(session,actor,manifest):
    for models,incoming,ceiling in [([Person],len(manifest.people),5000),([Parent,Care,Partner],len(manifest.parent_links)+len(manifest.care_links)+len(manifest.partner_episodes),20000),([Story,Residence],len(manifest.stories)+len(manifest.residences),40000)]:
        current=sum(session.scalar(select(func.count()).select_from(model).where(model.household_id==actor.household_id)) or 0 for model in models)
        if current+incoming>ceiling: error('resource_limit','Append would exceed collection capacity.',413)


def prepare_import(session,actor,job_id):
    row=jobs.get(session,actor,'import',job_id=job_id,allow_committed=True)
    prepared={}
    if row.state=='committed': return prepared
    for source_key,staged in row.payload.get('media',{}).items():
        data=storage.read(staged['key'],'artifacts')
        if storage.checksum(data)!=staged['checksum']: error('media_unavailable','Staged media integrity failed.')
        prepared[source_key]={**staged,'object_key':storage.write(data),'byte_size':len(data)}
    return prepared


def commit_import(session,actor,c,job_id,body,prepared):
    row=jobs.get(session,actor,'import',job_id=job_id)
    if row.expected_revision!=body.expected_graph_revision: error('revision_conflict','Preview revision does not match.')
    if row.summary['duplicate_provenance'] and not body.acknowledge_duplicate_provenance:
        error('merge_conflict','Explicitly acknowledge prior package provenance before appending again.')
    manifest=Manifest.model_validate(row.payload['manifest'])
    warnings=portable.validate(manifest); capacity(session,actor,manifest)
    media.check_capacity(session,actor.household_id,sum(m['byte_size'] for m in prepared.values()))
    person_map={}; story_map={}; asset_map={}; provenance={}; relationship_ids=[]; residence_ids=[]
    for source in manifest.people:
        p,_=people.add(session,actor,c,source.person)
        p.is_locked=source.is_locked; p.lock_reason=source.lock_reason
        if source.is_locked: p.locked_by_user_id=actor.id; p.locked_at=datetime.now(UTC)
        if source.archived: p.archived_at=datetime.now(UTC)
        person_map[source.key]=p
        provenance[source.key]=Source(household_id=actor.household_id,collection_id=c.id,created_by_user_id=actor.id,person_id=p.id,
            source_key=source.key,package_digest=row.payload['digest'],provenance={'person':source.provenance.model_dump(mode='json'),'records':{}})
        session.add(provenance[source.key])
    session.flush()
    for source in manifest.people:
        if source.merged_into_key: person_map[source.key].merged_into_person_id=person_map[source.merged_into_key].id
    def remember(person_key,group,local,original):
        mapping=provenance[person_key].provenance
        groups=mapping['records']; groups.setdefault(group,{})[str(local.id)]=original.model_dump(mode='json')
        provenance[person_key].provenance={**mapping,'records':groups}
    for group,model,fields in [('parent_links',Parent,{'parent_key':'parent_person_id','child_key':'child_person_id'}),('care_links',Care,{'caregiver_key':'caregiver_person_id','recipient_key':'recipient_person_id'}),('partner_episodes',Partner,{'person_a_key':'person_a_id','person_b_key':'person_b_id'})]:
        for original in getattr(manifest,group):
            values=original.model_dump(mode='json',exclude={'key','provenance',*fields})
            kind=values.pop('kind')
            endpoints={local:person_map[getattr(original,key)].id for key,local in fields.items()}
            if model is Partner: endpoints['person_a_id'],endpoints['person_b_id']=sorted(endpoints.values())
            r=model(household_id=actor.household_id,collection_id=c.id,created_by_user_id=actor.id,kind=kind,facts=values,**endpoints)
            session.add(r); session.flush()
            relationship_ids.append(r.id)
            remember(getattr(original,next(iter(fields))),group,r,original.provenance)
    for original in manifest.stories:
        r=Story(household_id=actor.household_id,collection_id=c.id,created_by_user_id=actor.id,person_id=person_map[original.person_key].id,facts=original.story.model_dump(mode='json'),position=original.position)
        session.add(r); session.flush(); story_map[original.key]=r
        remember(original.person_key,'stories',r,original.provenance)
    for original in manifest.residences:
        r=Residence(household_id=actor.household_id,collection_id=c.id,created_by_user_id=actor.id,person_id=person_map[original.person_key].id,
            facts=original.residence.model_dump(mode='json',exclude={'is_primary'}),is_primary=original.residence.is_primary)
        session.add(r); session.flush(); residence_ids.append(r.id)
        remember(original.person_key,'residences',r,original.provenance)
    for original in manifest.media:
        staged=row.payload['media'].get(original.key)
        if staged:
            published=prepared.get(original.key)
            if published is None or published['checksum']!=staged['checksum']:
                error('media_unavailable','Validated media publication is incomplete.')
            a=Asset(household_id=actor.household_id,collection_id=c.id,created_by_user_id=actor.id,
                object_key=published['object_key'],mime_type=staged['mime'],byte_size=published['byte_size'],checksum=staged['checksum'],
                width=staged['width'],height=staged['height'],caption=original.caption,state='ready')
            session.add(a); session.flush(); asset_map[original.key]=a
    refs=[]
    for original in manifest.media_references:
        asset=asset_map.get(original.asset_key)
        if asset:
            media.ready(session,actor.household_id,asset.id)
            r=Reference(household_id=actor.household_id,collection_id=c.id,created_by_user_id=actor.id,person_id=person_map[original.person_key].id,
                story_id=story_map[original.story_key].id if original.story_key else None,role=original.role,asset_id=asset.id)
            session.add(r); session.flush(); refs.append(r.id)
    if body.expected_graph_revision==0:
        c.title=manifest.collection_title
        c.default_focus_person_id=person_map[manifest.default_focus_key].id if manifest.default_focus_key else None
    # Staged artifact keys are retained for cleanup until job TTL, without
    # retaining the full sensitive logical manifest after completion.
    artifact_keys=[m['key'] for m in row.payload['media'].values()]
    jobs.consume(row); row.payload={'cleanup_artifact_keys':artifact_keys}
    session.flush()
    return {'person_ids':[p.id for p in person_map.values()],'story_ids':[s.id for s in story_map.values()],
        'relationship_ids':relationship_ids,'residence_ids':residence_ids,
        'media_asset_ids':[a.id for a in asset_map.values()],'media_reference_ids':refs},warnings


def cancel(session,actor,job_id):
    with storage.lock(exclusive=True):
        row=jobs.get(session,actor,'import',job_id=job_id)
        # Claim cancellation under SQL lock before deleting staged content;
        # an import commit either already won or now cannot read a ready job.
        updated=session.execute(update(type(row)).where(type(row).id==row.id,type(row).state=='ready').values(state='canceled')).rowcount
        if updated!=1: error('transfer_expired','This job is no longer cancelable.')
        keys=[m['key'] for m in row.payload.get('media',{}).values()]
        row.payload={}; session.commit()
        for key in keys: storage.unlink(key,'artifacts')
        return jobs.dto(row)
