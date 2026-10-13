"""Disposable real API acceptance slices for FT-3 (no production defaults)."""
import io
import json
import zipfile
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, func
from test_family_tree_api import tree, create, person_id, BASE


@pytest.fixture
def ft3(tree, tmp_path, monkeypatch):
    monkeypatch.setenv('FAMILY_TREE_STORAGE_ROOT', str(tmp_path / 'private'))
    yield tree


def png():
    from PIL import Image
    b = io.BytesIO()
    Image.new('RGB', (16, 16), 'red').save(b, format='PNG')
    return b.getvalue()


def upload(c, data=None, mime='image/png'):
    return c.post(BASE + '/media', files={'file': ('../../unsafe.png', png() if data is None else data, mime)})


def merge(c, source, target, rev, key='merge'):
    preview = c.post(BASE + '/merge-preview', json={'expected_graph_revision': rev, 'source_person_id': source, 'target_person_id': target, 'scalar_choices': {'display_name': 'target'}})
    assert preview.status_code == 200, preview.text
    return c.post(BASE + '/merge', json={'expected_graph_revision': rev, 'idempotency_key': key, 'preview_token': preview.json()['preview_token']})


def test_upload_reference_content_and_pins(ft3):
    c, factory, ids = ft3
    p = person_id(create(c))
    r = upload(c)
    assert r.status_code == 200, r.text
    asset = r.json()['id']
    assert r.json()['mime_type'] == 'image/png'
    attach = c.post(BASE + f'/media/{asset}/attach', json={'expected_graph_revision': 1, 'person_id': p, 'role': 'primary'})
    assert attach.status_code == 200, attach.text
    assert c.get(BASE + f'/people/{p}').json()['person']['primary_image_asset_id'] == asset
    content = c.get(BASE + f'/media/{asset}/content')
    assert content.status_code == 200 and set(content.headers['cache-control'].split(', ')) == {'private', 'no-store'}
    from PIL import Image
    assert not Image.open(io.BytesIO(content.content)).getexif()
    from app.services.family_tree import media
    from app.models.family_tree import FamilyTreeMediaAsset
    with factory() as s:
        row = s.get(FamilyTreeMediaAsset, asset)
        row.created_at = datetime.now(UTC) - timedelta(days=2)
        s.commit()
        assert media.claim_deletion(s, asset) is None
    assert upload(c, b'<svg/>', 'image/svg+xml').status_code == 422
    assert upload(c, png(), 'image/jpeg').status_code == 422


def test_merge_flat_aliases_and_owner_purge(ft3):
    c, factory, ids = ft3
    a = person_id(create(c, name='A'))
    b = person_id(create(c, rev=1, name='B', key='b'))
    d = person_id(create(c, rev=2, name='C', key='c'))
    assert merge(c, a, b, 3).status_code == 200
    assert merge(c, b, d, 4, 'second').status_code == 200
    assert c.get(BASE + f'/people/{a}').json()['person']['merged_into_person_id'] == d
    assert c.post(BASE + f'/people/{a}/restore', json={'expected_graph_revision': 5}).json()['detail']['code'] == 'person_merged'
    payload = {'expected_graph_revision': 5, 'password': 'password123'}
    blocked = c.post(BASE + f'/people/{d}/purge-preview', json=payload)
    assert blocked.status_code == 409 and blocked.json()['detail']['code'] == 'merge_aliases_present'
    for pid, rev in [(a, 5), (b, 6), (d, 7)]:
        preview = c.post(BASE + f'/people/{pid}/purge-preview', json={'expected_graph_revision': rev, 'password': 'password123'})
        assert preview.status_code == 200, preview.text
        commit = c.post(BASE + f'/people/{pid}/purge', json={'expected_graph_revision': rev, 'password': 'password123', 'preview_token': preview.json()['preview_token'], 'idempotency_key': f'purge{pid}'})
        assert commit.status_code == 200, commit.text
    assert c.get(BASE + '/people').json()['total'] == 0


def test_export_append_import_and_replay(ft3):
    c, factory, ids = ft3
    p = person_id(create(c, name='Original', tags=['tag'], birth_date={'value': '1984', 'uncertain': True}))
    asset = upload(c).json()['id']
    assert c.post(BASE + f'/media/{asset}/attach', json={'expected_graph_revision': 1, 'person_id': p, 'role': 'primary'}).status_code == 200
    assert c.post(BASE+f'/people/{p}/stories',json={'expected_graph_revision':2,'idempotency_key':'portable-story','story':{'title':'Portable story','body_md':'**Retained**','date':{'value':'2000'}}}).status_code==200
    assert c.post(BASE+f'/people/{p}/residences',json={'expected_graph_revision':3,'residence':{'place':'Portable place','is_primary':True,'start_date':{'value':'2000'}}}).status_code==200
    assert c.post(BASE+'/relatives',json={'expected_graph_revision':4,'idempotency_key':'portable-child','anchor_person_id':p,'person':{'display_name':'Child relative'},'relationship':{'direction':'child','kind':'adoptive'}}).status_code==200
    exp = c.post(BASE + '/exports', json={'format': 'zip'})
    assert exp.status_code == 200, exp.text
    data = c.get(BASE + '/exports/' + str(exp.json()['id']) + '/download').content
    z = zipfile.ZipFile(io.BytesIO(data)); manifest = json.loads(z.read('manifest.json'))
    assert manifest['schema_version'] == 1 and manifest['snapshot_revision'] == 5
    assert 'household_id' not in manifest and 'identity_links' not in manifest
    staged = c.post(BASE + '/imports', data={'expected_graph_revision': '5'}, files={'file': ('tree.zip', data, 'application/zip')})
    assert staged.status_code == 200, staged.text
    job = staged.json()['id']
    body = {'expected_graph_revision': 5, 'idempotency_key': 'import', 'confirmed': True, 'reviewed_warnings': ['chronology_review']}
    result = c.post(BASE + f'/imports/{job}/commit', json=body)
    assert result.status_code == 200, result.text
    assert c.post(BASE + f'/imports/{job}/commit', json=body).json()['replayed']
    new = result.json()['affected']['person_ids'][0]
    assert new != p
    detail = c.get(BASE + f'/people/{new}').json()['person']
    assert detail['tags'] == ['tag'] and detail['birth_date']['uncertain']
    assert detail['primary_image_asset_id'] != asset
    assert len(result.json()['affected']['relationship_ids'])==1
    assert len(result.json()['affected']['residence_ids'])==1
    assert c.get(BASE+f'/people/{new}').json()['parent_links'][0]['kind']=='adoptive'
    assert c.get(BASE+f'/people/{new}/stories').json()['items'][0]['body_md']=='**Retained**'
    assert c.get(BASE+f'/people/{new}/residences').json()['items'][0]['is_primary'] is True


def test_zip_path_rejected_and_stale_import_is_atomic(ft3):
    c, factory, ids = ft3
    p = person_id(create(c))
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w') as z:
        z.writestr('../outside', 'x')
        z.writestr('manifest.json', '{}')
    r = c.post(BASE + '/imports', data={'expected_graph_revision': '1'}, files={'file': ('bad.zip', out.getvalue(), 'application/zip')})
    assert r.status_code == 422, r.text
    exp = c.post(BASE + '/exports', json={'format': 'json'}).json()
    data = c.get(BASE + f'/exports/{exp["id"]}/download').content
    stage = c.post(BASE + '/imports', data={'expected_graph_revision': '1'}, files={'file': ('tree.json', data, 'application/json')})
    assert stage.status_code == 200, stage.text
    person_id(create(c, rev=1, name='Concurrent', key='concurrent'))
    result = c.post(BASE + f'/imports/{stage.json()["id"]}/commit', json={'expected_graph_revision': 1, 'idempotency_key': 'stale', 'confirmed': True})
    assert result.status_code == 409
    assert c.get(BASE + '/people').json()['total'] == 2

@pytest.mark.parametrize('route,method', [('/exports','post'),('/imports','post'),('/merge-preview','post'),('/media','post')])
def test_view_only_cannot_start_ft3(ft3,route,method):
    from app.models import UserModuleAccess
    c,factory,ids=ft3
    person_id(create(c))
    with factory() as s:
        s.add(UserModuleAccess(user_id=ids['owner'],module_key='family-tree',can_view=True,can_manage=False)); s.commit()
    response=getattr(c,method)(BASE+route,json={})
    assert response.status_code==403


def login(c,email):
    r=c.post('/chore-api/auth/login',json={'email':email,'password':'password123'})
    assert r.status_code==200
    c.headers['X-CSRF-Token']=r.json()['csrf_token']


def test_cross_household_media_jobs_and_nonowner_purge(ft3):
    c,factory,ids=ft3
    p=person_id(create(c)); asset=upload(c).json()['id']
    exp=c.post(BASE+'/exports',json={'format':'json'}).json()['id']
    data=c.get(BASE+f'/exports/{exp}/download').content
    imp=c.post(BASE+'/imports',data={'expected_graph_revision':'1'},files={'file':('t.json',data,'application/json')}).json()['id']
    login(c,'PARENT@example.test')
    assert c.post(BASE+f'/people/{p}/purge-preview',json={'expected_graph_revision':1,'password':'password123'}).status_code==403
    login(c,'other@example.test')
    for path in [f'/media/{asset}/content',f'/exports/{exp}',f'/exports/{exp}/download',f'/imports/{imp}']:
        assert c.get(BASE+path).status_code==404
    assert c.request('DELETE',BASE+f'/imports/{imp}').status_code==404
    assert c.post(BASE+f'/imports/{imp}/commit',json={'expected_graph_revision':0,'idempotency_key':'x','confirmed':True}).status_code==404
    assert c.post(BASE+'/merge-preview',json={'expected_graph_revision':0,'source_person_id':p,'target_person_id':999}).status_code==404


def test_cleanup_claim_recovery_and_pin_exclusion(ft3):
    from app.services.family_tree import media, storage
    from app.models.family_tree import FamilyTreeMediaAsset as Asset, FamilyTreeMediaPin as Pin
    c,factory,ids=ft3
    p=person_id(create(c)); asset=upload(c).json()['id']
    with factory() as s:
        row=s.get(Asset,asset); row.created_at=datetime.now(UTC)-timedelta(days=2)
        for old in s.scalars(select(Pin).where(Pin.asset_id==asset,Pin.purpose=='upload')): old.expires_at=datetime.now(UTC)-timedelta(days=1)
        s.commit()
        media.pin(s,row,'f'*64,'backup',datetime.now(UTC)+timedelta(days=1)); s.commit()
    with factory() as s:
        assert media.claim_deletion(s,asset) is None
        pin=s.scalar(select(Pin).where(Pin.asset_id==asset,Pin.purpose=='backup')); s.delete(pin); s.commit()
        token=media.claim_deletion(s,asset)
        assert token
        row=s.get(Asset,asset); key=row.object_key
        assert storage.read(key)
    r=c.post(BASE+f'/media/{asset}/attach',json={'expected_graph_revision':1,'person_id':p,'role':'primary'})
    assert r.status_code==409 and r.json()['detail']['code']=='media_unavailable'
    assert c.get(BASE+'/').json()['graph_revision']==1
    with factory() as s:
        row=s.get(Asset,asset); row.claim_expires_at=datetime.now(UTC)-timedelta(seconds=1); s.commit()
        retry=media.claim_deletion(s,asset)
        assert retry and retry!=token
        assert not media.finish_deletion(s,asset,token)
        assert media.finish_deletion(s,asset,retry)
        assert not storage.path(key).exists()
        assert s.get(Asset,asset).state=='deleted'
        assert not media.finish_deletion(s,asset,retry)


def test_merge_relationship_conflict_and_rollback(ft3,monkeypatch):
    from app.models.family_tree import FamilyTreePerson, FamilyTreeStory
    from app.services.family_tree import merge as merger
    c,factory,ids=ft3
    a=person_id(create(c,name='A')); b=person_id(create(c,rev=1,name='B',key='b'))
    assert c.post(BASE+'/parent-links',json={'expected_graph_revision':2,'parent_person_id':a,'child_person_id':b,'kind':'biological'}).status_code==200
    preview=c.post(BASE+'/merge-preview',json={'expected_graph_revision':3,'source_person_id':a,'target_person_id':b,'scalar_choices':{'display_name':'target'}})
    assert preview.status_code==409
    assert c.get(BASE+'/').json()['graph_revision']==3
    # Remove the self-producing link, then fail after rewrites but before commit.
    link=c.get(BASE+f'/people/{a}').json()['parent_links'][0]['id']
    assert c.request('DELETE',BASE+f'/parent-links/{link}',json={'expected_graph_revision':3}).status_code==200
    story=c.post(BASE+f'/people/{a}/stories',json={'expected_graph_revision':4,'idempotency_key':'story','story':{'title':'Keep','body_md':'body'}}).json()['affected']['story_ids'][0]
    preview=c.post(BASE+'/merge-preview',json={'expected_graph_revision':5,'source_person_id':a,'target_person_id':b,'scalar_choices':{'display_name':'target'}}).json()
    def fail(*args): raise ValueError('Injected precommit failure')
    monkeypatch.setattr(merger.people,'save_facts',fail)
    result=c.post(BASE+'/merge',json={'expected_graph_revision':5,'preview_token':preview['preview_token'],'idempotency_key':'rollback'})
    assert result.status_code==422
    with factory() as s:
        assert s.get(FamilyTreeStory,story).person_id==a
        assert s.get(FamilyTreePerson,a).merged_into_person_id is None
    assert c.get(BASE+'/').json()['graph_revision']==5


def test_cancel_expiry_limits_and_checksum(ft3,monkeypatch):
    from app.services.family_tree import cleanup
    from app.models.family_tree import FamilyTreeTransferJob as Job
    c,factory,ids=ft3
    person_id(create(c))
    monkeypatch.setenv('FAMILY_TREE_IMAGE_MAX_BYTES','16')
    assert upload(c).status_code==413
    monkeypatch.delenv('FAMILY_TREE_IMAGE_MAX_BYTES')
    asset=upload(c).json()['id']
    assert c.post(BASE+f'/media/{asset}/attach',json={'expected_graph_revision':1,'person_id':1,'role':'primary'}).status_code==200
    exp=c.post(BASE+'/exports',json={'format':'zip'}).json()['id']
    data=c.get(BASE+f'/exports/{exp}/download').content
    source=zipfile.ZipFile(io.BytesIO(data)); manifest=json.loads(source.read('manifest.json'))
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:
        manifest['media'][0]['checksum']='0'*64
        z.writestr('manifest.json',json.dumps(manifest))
        for name in source.namelist():
            if name!='manifest.json': z.writestr(name,source.read(name))
    result=c.post(BASE+'/imports',data={'expected_graph_revision':'2'},files={'file':('bad.zip',out.getvalue(),'application/zip')})
    assert result.status_code==422
    stage=c.post(BASE+'/imports',data={'expected_graph_revision':'2'},files={'file':('valid.zip',data,'application/zip')}).json()
    assert c.request('DELETE',BASE+f'/imports/{stage["id"]}').status_code==200
    assert c.post(BASE+f'/imports/{stage["id"]}/commit',json={'expected_graph_revision':2,'idempotency_key':'cancelled','confirmed':True}).status_code==409
    with factory() as s:
        job=s.get(Job,exp); job.expires_at=datetime.now(UTC)-timedelta(seconds=1); s.commit()
    assert c.get(BASE+f'/exports/{exp}/download').json()['detail']['code']=='transfer_expired'
    result=cleanup.cleanup(factory)
    assert result['expired_jobs']>=1
    assert c.get(BASE+'/people').json()['total']==1


def test_backup_online_restore_with_media_and_other_modules(ft3,tmp_path,monkeypatch):
    from app.services.family_tree import recovery, storage
    from app.models.family_tree import FamilyTreeMediaAsset as Asset,FamilyTreeMediaPin as Pin
    c,factory,ids=ft3
    p=person_id(create(c)); asset=upload(c).json()['id']
    assert c.post(BASE+f'/media/{asset}/attach',json={'expected_graph_revision':1,'person_id':p,'role':'primary'}).status_code==200
    from app.models import Tag,User
    with factory() as s:
        s.add(Tag(household_id=ids['household'],name='Unrelated chore tag'));s.commit()
        database=s.get_bind().url.database
    package=tmp_path/'backup'
    manifest=recovery.backup(database,package,factory)
    assert len(manifest['objects'])==1
    result=recovery.rehearse(package,tmp_path/'restored',scratch_root=tmp_path)
    assert result['integrity_check']=='ok' and result['foreign_key_check']=='ok'
    assert result['counts']['users']==4 and result['counts']['family_tree_people']==1
    with factory() as s:
        assert s.scalar(select(func.count()).select_from(Pin).where(Pin.asset_id==asset,Pin.purpose=='backup'))==1
    import sqlite3
    with sqlite3.connect(tmp_path/'restored'/'database.sqlite') as db:
        assert db.execute('SELECT facts FROM family_tree_people WHERE id=?',(p,)).fetchone()
        assert db.execute('SELECT owner_user_id FROM households WHERE id=?',(ids['household'],)).fetchone()[0]==ids['owner']
        assert db.execute('SELECT name FROM tags').fetchone()[0]=='Unrelated chore tag'
    from app.db import get_session_factory
    from app.services.family_tree import people,media
    restored_factory=get_session_factory('sqlite:///'+str(tmp_path/'restored'/'database.sqlite'))
    with monkeypatch.context() as m:
        m.setenv('FAMILY_TREE_STORAGE_ROOT',str(tmp_path/'restored'))
        with restored_factory() as s:
            actor=s.get(User,ids['owner'])
            assert people.detail(s,actor,p)['person']['primary_image_asset_id']==asset
            assert media.content(s,actor,asset)[0]
    # Corruption cannot be called a valid recovery point or installed.
    (package/'objects'/manifest['objects'][0]['key']).write_bytes(b'bad')
    with pytest.raises(ValueError,match='checksum'): recovery.rehearse(package,tmp_path/'bad-restore',scratch_root=tmp_path)
    assert not (tmp_path/'bad-restore').exists()


@pytest.mark.parametrize('mutation', ['unknown_version','unknown_field','cycle','flat_alias','invalid_date'])
def test_import_full_validation_before_domain_changes(ft3,mutation):
    c,factory,ids=ft3
    person_id(create(c))
    exp=c.post(BASE+'/exports',json={'format':'json'}).json()['id']
    manifest=json.loads(c.get(BASE+f'/exports/{exp}/download').content)
    if mutation=='unknown_version': manifest['schema_version']=99
    if mutation=='unknown_field': manifest['household_id']=ids['other_household']
    if mutation=='invalid_date': manifest['people'][0]['person']['birth_date']={'value':'1900-02-29'}
    if mutation=='flat_alias': manifest['people'][0].update(archived=True,merged_into_key=manifest['people'][0]['key'])
    if mutation=='cycle':
        key=manifest['people'][0]['key']; other=json.loads(json.dumps(manifest['people'][0]));other['key']='p:other';manifest['people'].append(other)
        manifest['parent_links']=[{'key':'link:1','parent_key':key,'child_key':'p:other','kind':'biological'},{'key':'link:2','parent_key':'p:other','child_key':key,'kind':'adoptive'}]
    r=c.post(BASE+'/imports',data={'expected_graph_revision':'1'},files={'file':('bad.json',json.dumps(manifest).encode(),'application/json')})
    assert r.status_code in {422,409}
    assert c.get(BASE+'/people').json()['total']==1
    assert c.get(BASE+'/').json()['graph_revision']==1

def test_alias_only_person_merge_remains_exportable(ft3):
    c,factory,ids=ft3
    response=c.post(BASE+'/people',json={'expected_graph_revision':0,'idempotency_key':'alias-only','person':{'aliases':[{'name':'One name','label':'Original'}]}})
    a=person_id(response); b=person_id(create(c,rev=1,key='b'))
    assert merge(c,a,b,2).status_code==200
    result=c.post(BASE+'/exports',json={'format':'json'})
    assert result.status_code==200,result.text
    manifest=json.loads(c.get(BASE+f'/exports/{result.json()["id"]}/download').content)
    original=next(p for p in manifest['people'] if p['key']==f'p:{a}')
    assert original['person']['aliases'][0]['name']=='One name'


def test_import_rejects_coerced_lock_flags(ft3):
    c,factory,ids=ft3
    person_id(create(c))
    exp=c.post(BASE+'/exports',json={'format':'json'}).json()['id']
    manifest=json.loads(c.get(BASE+f'/exports/{exp}/download').content)
    manifest['people'][0]['is_locked']='false'
    result=c.post(BASE+'/imports',data={'expected_graph_revision':'1'},files={'file':('t.json',json.dumps(manifest).encode(),'application/json')})
    assert result.status_code==422

def test_request_boundary_rejects_oversize_declared_body(ft3):
    c,factory,ids=ft3
    person_id(create(c))
    result=c.post(BASE+'/exports',json={'format':'json'},headers={'Content-Length':'1000000000'})
    assert result.status_code==413

@pytest.mark.parametrize('retainer',['attachment','pin'])
def test_real_concurrent_cleanup_serializes_with_retainer(ft3,retainer):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from app.models import User
    from app.models.family_tree import FamilyTreeMediaAsset as Asset, FamilyTreeMediaReference as Ref, FamilyTreeMediaPin as Pin
    from app.schemas.family_tree_transfer import AttachMedia
    from app.services.family_tree import media
    from app.services.family_tree.mutations import execute
    c,factory,ids=ft3
    p=person_id(create(c)); asset=upload(c).json()['id']
    with factory() as s:
        row=s.get(Asset,asset);row.created_at=datetime.now(UTC)-timedelta(days=2)
        for old in s.scalars(select(Pin).where(Pin.asset_id==asset,Pin.purpose=='upload')): old.expires_at=datetime.now(UTC)-timedelta(days=1)
        s.commit()
    owns_lock=Event(); release=Event()
    def retain():
        with factory() as s:
            actor=s.get(User,ids['owner']); row=media.ready(s,actor.household_id,asset)
            owns_lock.set(); assert release.wait(3)
            if retainer=='pin':
                media.pin(s,row,'e'*64,'export',datetime.now(UTC)+timedelta(days=1));s.commit()
            else:
                body=AttachMedia(expected_graph_revision=1,person_id=p,role='primary')
                execute(s,actor,'media.attach',body,lambda col:media.attach(s,actor,col,asset,body));s.commit()
    def claim():
        with factory() as s: return media.claim_deletion(s,asset)
    with ThreadPoolExecutor(max_workers=2) as pool:
        future=pool.submit(retain); assert owns_lock.wait(3)
        cleaner=pool.submit(claim); release.set(); future.result(timeout=5)
        assert cleaner.result(timeout=5) is None
    with factory() as s:
        assert s.get(Asset,asset).state=='ready'
        if retainer=='attachment': assert s.scalar(select(func.count()).select_from(Ref).where(Ref.asset_id==asset))==1


def test_snapshot_stays_consistent_during_concurrent_edit(ft3,monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from app.models import User
    from app.schemas.family_tree import PatchPerson
    from app.services.family_tree import portable,people
    from app.services.family_tree.mutations import execute
    c,factory,ids=ft3
    p=person_id(create(c,name='Before'))
    original=portable.snapshot
    pending=[]
    def edit():
        with factory() as s:
            actor=s.get(User,ids['owner']); body=PatchPerson(expected_graph_revision=1,changes={'display_name':'After'})
            execute(s,actor,'person.patch:'+str(p),body,lambda col:people.edit(s,actor,col,p,body.changes));s.commit()
    with ThreadPoolExecutor(max_workers=1) as pool:
        def snapshot(*args,**kwargs):
            pending.append(pool.submit(edit))
            return original(*args,**kwargs)
        monkeypatch.setattr(portable,'snapshot',snapshot)
        result=c.post(BASE+'/exports',json={'format':'json'})
        assert result.status_code==200,result.text
        pending[0].result(timeout=10)
    manifest=json.loads(c.get(BASE+f'/exports/{result.json()["id"]}/download').content)
    assert manifest['snapshot_revision']==1 and manifest['people'][0]['person']['display_name']=='Before'
    assert c.get(BASE+f'/people/{p}').json()['person']['display_name']=='After'


def test_purge_shared_image_preserves_snapshot_and_other_person(ft3):
    from app.models.family_tree import FamilyTreeMediaAsset as Asset
    from app.services.family_tree import media
    c,factory,ids=ft3
    a=person_id(create(c,name='A'));b=person_id(create(c,rev=1,name='B',key='b'))
    asset=upload(c).json()['id']
    for pid,rev in [(a,2),(b,3)]:
        assert c.post(BASE+f'/media/{asset}/attach',json={'expected_graph_revision':rev,'person_id':pid,'role':'primary'}).status_code==200
    exp=c.post(BASE+'/exports',json={'format':'zip'}).json()['id']
    preview=c.post(BASE+f'/people/{a}/purge-preview',json={'expected_graph_revision':4,'password':'password123'}).json()
    result=c.post(BASE+f'/people/{a}/purge',json={'expected_graph_revision':4,'password':'password123','preview_token':preview['preview_token'],'idempotency_key':'purge-shared'})
    assert result.status_code==200
    assert c.get(BASE+f'/people/{b}').json()['person']['primary_image_asset_id']==asset
    with factory() as s:
        row=s.get(Asset,asset);row.created_at=datetime.now(UTC)-timedelta(days=2);s.commit()
        assert media.claim_deletion(s,asset) is None
    assert c.get(BASE+f'/media/{asset}/content').status_code==200
    manifest=json.loads(zipfile.ZipFile(io.BytesIO(c.get(BASE+f'/exports/{exp}/download').content)).read('manifest.json'))
    assert len(manifest['people'])==2 and len(manifest['media'])==1


def test_import_failure_after_publication_rolls_back_domain(ft3,monkeypatch):
    from app.models.family_tree import FamilyTreePerson,FamilyTreeMediaReference
    from app.services.family_tree import jobs
    c,factory,ids=ft3
    p=person_id(create(c)); asset=upload(c).json()['id']
    assert c.post(BASE+f'/media/{asset}/attach',json={'expected_graph_revision':1,'person_id':p,'role':'primary'}).status_code==200
    exp=c.post(BASE+'/exports',json={'format':'zip'}).json()['id']
    data=c.get(BASE+f'/exports/{exp}/download').content
    staged=c.post(BASE+'/imports',data={'expected_graph_revision':'2'},files={'file':('t.zip',data,'application/zip')}).json()['id']
    def fail(row): raise ValueError('Injected transaction failure')
    monkeypatch.setattr(jobs,'consume',fail)
    result=c.post(BASE+f'/imports/{staged}/commit',json={'expected_graph_revision':2,'idempotency_key':'rollback-import','confirmed':True})
    assert result.status_code==422
    assert c.get(BASE+'/').json()['graph_revision']==2
    with factory() as s:
        assert s.scalar(select(func.count()).select_from(FamilyTreePerson))==1
        assert s.scalar(select(func.count()).select_from(FamilyTreeMediaReference))==1
    assert c.get(BASE+f'/media/{asset}/content').status_code==200


@pytest.mark.parametrize('unsafe',['symlink','duplicate','traversal','excess_expansion'])
def test_archive_structure_defenses(ft3,unsafe,monkeypatch):
    c,factory,ids=ft3
    person_id(create(c))
    exp=c.post(BASE+'/exports',json={'format':'json'}).json()['id']
    data=c.get(BASE+f'/exports/{exp}/download').content
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:
        z.writestr('manifest.json',data)
        if unsafe=='duplicate':
            with pytest.warns(UserWarning): z.writestr('manifest.json',data)
        elif unsafe=='symlink':
            info=zipfile.ZipInfo('media/link'); info.create_system=3; info.external_attr=(0o120777<<16); z.writestr(info,'/etc/passwd')
        elif unsafe=='traversal': z.writestr('media/../../outside','x')
    if unsafe=='excess_expansion': monkeypatch.setenv('FAMILY_TREE_IMPORT_MAX_EXPANDED_BYTES','16')
    result=c.post(BASE+'/imports',data={'expected_graph_revision':'1'},files={'file':('bad.zip',out.getvalue(),'application/zip')})
    assert result.status_code==(413 if unsafe=='excess_expansion' else 422)
    assert c.get(BASE+'/people').json()['total']==1


def test_streamed_body_cap_without_trusted_length():
    import asyncio
    from app.security.family_tree_limits import FamilyTreeBodyLimitMiddleware
    received=[];sent=[]
    async def app(scope,receive,send):
        while True:
            event=await receive()
            if not event.get('more_body'): break
        await send({'type':'http.response.start','status':200,'headers':[]})
        await send({'type':'http.response.body','body':b'ok'})
    async def receive():
        received.append(1)
        return {'type':'http.request','body':b'x'*1024*1024,'more_body':len(received)<20}
    async def send(event): sent.append(event)
    asyncio.run(FamilyTreeBodyLimitMiddleware(app)({'type':'http','path':BASE+'/people','headers':[(b'content-length',b'1')]},receive,send))
    assert len(received)==17 and sent[0]['status']==413


def test_cookie_csrf_boundary_for_multipart(ft3):
    c,factory,ids=ft3
    person_id(create(c))
    csrf=c.headers.pop('X-CSRF-Token')
    assert upload(c).status_code==403
    c.headers['X-CSRF-Token']=csrf
    assert upload(c).status_code==200

def test_household_media_quota_before_publication(ft3,monkeypatch):
    c,factory,ids=ft3
    person_id(create(c))
    monkeypatch.setenv('FAMILY_TREE_HOUSEHOLD_MEDIA_MAX_BYTES','16')
    assert upload(c).status_code==413
    assert c.get(BASE+'/').json()['graph_revision']==1
    monkeypatch.setenv('FAMILY_TREE_IMPORT_MAX_BYTES','16')
    assert c.post(BASE+'/exports',json={'format':'zip'}).status_code==413
    assert c.get(BASE+'/').json()['graph_revision']==1


def test_real_decode_strips_exif_and_enforces_pixels(monkeypatch):
    from PIL import Image
    from app.services.family_tree import media
    from fastapi import HTTPException
    b=io.BytesIO(); image=Image.new('RGB',(16,16),'red')
    exif=Image.Exif();exif[270]='private metadata';exif[315]='private author'
    image.save(b,format='JPEG',exif=exif)
    clean,mime,width,height=media.sanitize(b.getvalue(),'image/jpeg')
    assert mime=='image/jpeg' and (width,height)==(16,16)
    assert not Image.open(io.BytesIO(clean)).getexif()
    assert b'private' not in clean
    monkeypatch.setenv('FAMILY_TREE_IMAGE_MAX_PIXELS','100')
    with pytest.raises(HTTPException) as failure: media.sanitize(b.getvalue(),'image/jpeg')
    assert failure.value.status_code==413


def test_cleanup_orphans_progress_and_corrupt_cursor_recovery(ft3):
    import os
    from app.services.family_tree import cleanup,storage
    c,factory,ids=ft3
    person_id(create(c));upload(c)
    orphans=[]
    for n in range(3):
        key=storage.write(b'orphan');orphans.append(key)
        os.utime(storage.path(key),(0,0))
    (storage.root()/'.cleanup-cursor').write_text('interrupted')
    for _ in range(8): cleanup.cleanup(factory,batch_size=1)
    assert all(not storage.path(key).exists() for key in orphans)
