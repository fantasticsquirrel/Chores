"""FT3 independent-review regressions on create_all and migrated schemas."""
import asyncio
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from test_family_tree_ft3 import tree, ft3, upload, merge, create, person_id, BASE
from app.models.family_tree import FamilyTreePerson, FamilyTreePersonTag, FamilyTreeOtherName, FamilyTreeParentLink, FamilyTreeCareLink, FamilyTreePartnerEpisode, FamilyTreeImportSourceKey, FamilyTreeMediaAsset
from app.services.family_tree import storage

pytestmark=pytest.mark.parametrize('tree',[False,True],indirect=True)


@pytest.mark.parametrize('field',['tags','aliases'])
def test_merge_capacity_preview_and_claimed_commit(ft3,field):
    c,factory,_=ft3
    def values(prefix,n): return [f'{prefix}{i}' for i in range(n)] if field=='tags' else [{'name':f'{prefix}{i}'} for i in range(n)]
    a=person_id(create(c,name='A',**{field:values('A',30)}))
    b=person_id(create(c,1,'B','b',**{field:values('B',30)}))
    preview={'expected_graph_revision':2,'source_person_id':a,'target_person_id':b,'scalar_choices':{'display_name':'target'}}
    r=c.post(BASE+'/merge-preview',json=preview)
    assert r.status_code==409 and r.json()['detail']['code']=='merge_conflict'
    assert c.get(BASE+'/').json()['graph_revision']==2
    assert c.patch(BASE+f'/people/{a}',json={'expected_graph_revision':2,'changes':{field:values('A',20)}}).status_code==200
    preview['expected_graph_revision']=3
    r=c.post(BASE+'/merge-preview',json=preview);assert r.status_code==200
    # A direct corrupt writer must still be rejected in claimed commit; it may
    # not turn a valid preview into an unreadable canonical person.
    with factory() as s:
        col=s.get(FamilyTreePerson,a).collection_id
        model=FamilyTreePersonTag if field=='tags' else FamilyTreeOtherName
        kw={'tag':'overflow'} if field=='tags' else {'name':'overflow','position':100}
        row=model(household_id=s.get(FamilyTreePerson,a).household_id,collection_id=col,person_id=a,**kw);s.add(row);s.commit();rid=row.id
    result=c.post(BASE+'/merge',json={'expected_graph_revision':3,'idempotency_key':'capacity','preview_token':r.json()['preview_token']})
    assert result.status_code==422
    assert c.get(BASE+'/').json()['graph_revision']==3
    with factory() as s:
        assert s.get(FamilyTreePerson,a).merged_into_person_id is None
        s.delete(s.get(model,rid));s.commit()
    assert merge(c,a,b,3).status_code==200
    with factory() as s: assert s.get(FamilyTreePerson,a).merged_into_person_id==b
    assert len(c.get(BASE+f'/people/{b}').json()['person'][field])==50
    assert c.get(BASE+'/people').status_code==200
    assert c.post(BASE+'/exports',json={'format':'json'}).status_code==200


def test_private_response_validation_exceptions_never_log_inputs(ft3,caplog):
    c,factory,_=ft3
    p=person_id(create(c))
    marker='private-review-marker'
    with factory() as s:
        person=s.get(FamilyTreePerson,p)
        for i in range(51):s.add(FamilyTreePersonTag(household_id=person.household_id,collection_id=person.collection_id,person_id=p,tag=f'{marker}-{i}'))
        s.commit()
    caplog.clear()
    with TestClient(c.app,raise_server_exceptions=False) as client:
        # App startup configures root logging; attach capture after that boundary.
        import logging
        logging.getLogger().addHandler(caplog.handler)
        client.cookies.update(c.cookies);r=client.get(BASE+f'/people/{p}')
    assert r.status_code==500
    assert marker not in caplog.text
    failed=[rec for rec in caplog.records if 'request_failed' in rec.getMessage() or 'request.failed' in rec.getMessage()]
    assert failed and all(rec.exc_info is None for rec in failed)
    # Default TestClient re-raises any exception escaping to ServerErrorMiddleware
    # (the same exception Uvicorn would log, including validation inputs).
    # The privacy boundary must contain it inside the user middleware stack.
    assert c.get(BASE+f'/people/{p}').status_code==500


@pytest.mark.parametrize('kind',['parent','care','partner'])
def test_purge_checks_incident_locks_in_preview_and_commit(ft3,kind):
    c,factory,_=ft3
    a=person_id(create(c));b=person_id(create(c,1,'B','b'))
    path={'parent':'/parent-links','care':'/care-links','partner':'/partner-episodes'}[kind]
    values={'parent_person_id':b,'child_person_id':a,'kind':'adoptive'} if kind=='parent' else {'caregiver_person_id':b,'recipient_person_id':a,'kind':'caregiver'} if kind=='care' else {'person_a_id':a,'person_b_id':b,'kind':'partners'}
    rid=c.post(BASE+path,json={'expected_graph_revision':2,**values}).json()['affected']['relationship_ids'][0]
    preview=c.post(BASE+f'/people/{a}/purge-preview',json={'expected_graph_revision':3,'password':'password123'});assert preview.status_code==200
    assert c.post(BASE+f'/people/{b}/lock',json={'expected_graph_revision':3,'reason':'Protected'}).status_code==200
    locked=c.post(BASE+f'/people/{a}/purge-preview',json={'expected_graph_revision':4,'password':'password123'})
    assert locked.status_code==409 and locked.json()['detail']['code']=='person_locked'
    # Prove recheck inside claim with a preview whose revision still matches.
    with factory() as s:
        s.get(FamilyTreePerson,b).is_locked=False;s.commit()
    valid=c.post(BASE+f'/people/{a}/purge-preview',json={'expected_graph_revision':4,'password':'password123'});assert valid.status_code==200
    with factory() as s:s.get(FamilyTreePerson,b).is_locked=True;s.commit()
    result=c.post(BASE+f'/people/{a}/purge',json={'expected_graph_revision':4,'password':'password123','preview_token':valid.json()['preview_token'],'idempotency_key':'locked'})
    assert result.status_code==409 and result.json()['detail']['code']=='person_locked'
    assert c.get(BASE+'/').json()['graph_revision']==4
    model={'parent':FamilyTreeParentLink,'care':FamilyTreeCareLink,'partner':FamilyTreePartnerEpisode}[kind]
    with factory() as s:
        assert s.get(model,rid) is not None and s.get(FamilyTreePerson,a) is not None
        assert s.get(FamilyTreePerson,b).is_locked


def test_rejected_imports_publish_no_objects_and_replays_do_not_amplify(ft3):
    c,factory,_=ft3
    p=person_id(create(c));asset=upload(c).json()['id']
    assert c.post(BASE+f'/media/{asset}/attach',json={'expected_graph_revision':1,'person_id':p,'role':'gallery'}).status_code==200
    exp=c.post(BASE+'/exports',json={'format':'zip'}).json()['id'];data=c.get(BASE+f'/exports/{exp}/download').content
    staged=c.post(BASE+'/imports',data={'expected_graph_revision':'2'},files={'file':('tree.zip',data,'application/zip')});assert staged.status_code==200
    job=staged.json()['id'];body={'expected_graph_revision':2,'idempotency_key':'import','confirmed':True}
    paths=lambda: {p.name:p.stat().st_size for p in (storage.root()/'objects').iterdir()}
    before=paths()
    person_id(create(c,2,'Concurrent','concurrent'))
    for _ in range(3):
        result=c.post(BASE+f'/imports/{job}/commit',json=body)
        assert result.status_code==409 and result.json()['detail']['code']=='revision_conflict'
        assert paths()==before
    with factory() as s: assert s.scalar(select(func.count()).select_from(FamilyTreeMediaAsset))==1
    staged=c.post(BASE+'/imports',data={'expected_graph_revision':'3'},files={'file':('tree.zip',data,'application/zip')});assert staged.status_code==200
    job=staged.json()['id'];body['expected_graph_revision']=3
    result=c.post(BASE+f'/imports/{job}/commit',json=body);assert result.status_code==200,result.text
    committed=paths()
    for _ in range(3):
        assert c.post(BASE+f'/imports/{job}/commit',json=body).json()['replayed']
        result=c.post(BASE+f'/imports/{job}/commit',json={**body,'acknowledge_duplicate_provenance':True})
        assert result.status_code==409 and result.json()['detail']['code']=='idempotency_conflict'
        assert paths()==committed


def test_import_commit_uses_transfer_admission_budget(tree):
    from app.security.family_tree_limits import FamilyTreeBodyLimitMiddleware, _TRANSFER_WORKERS
    assert _TRANSFER_WORKERS.acquire(blocking=False)
    assert _TRANSFER_WORKERS.acquire(blocking=False)
    sent=[]
    async def app(scope,receive,send):await send({'type':'http.response.start','status':200,'headers':[]})
    async def receive():return {'type':'http.request','body':b''}
    async def send(event):sent.append(event)
    try:
        asyncio.run(FamilyTreeBodyLimitMiddleware(app)({'type':'http','path':BASE+'/imports/1/commit','method':'POST','headers':[]},receive,send))
    finally:_TRANSFER_WORKERS.release();_TRANSFER_WORKERS.release()
    assert sent[0]['status']==503


def test_record_provenance_persists_all_groups_then_merge_alias_purge(ft3):
    c,factory,_=ft3
    target=person_id(create(c,name='Target'))
    groups=['parent_links','care_links','partner_episodes','stories','residences']
    original={group:{'source_label':group+' source','attribution':group+' author','created_at':'1900-01-01'} for group in groups}
    manifest={'schema_version':1,'producer':'fixture','exported_at':'2026-10-13','collection_title':'Incoming','snapshot_revision':7,
        'people':[{'key':'a','person':{'display_name':'Incoming'}},{'key':'b','person':{'display_name':'Other'}}],
        'parent_links':[{'key':'pl','parent_key':'a','child_key':'b','kind':'adoptive','provenance':original['parent_links']}],
        'care_links':[{'key':'cl','caregiver_key':'a','recipient_key':'b','kind':'guardian','provenance':original['care_links']}],
        'partner_episodes':[{'key':'pa','person_a_key':'a','person_b_key':'b','kind':'partners','provenance':original['partner_episodes']}],
        'stories':[{'key':'story','person_key':'a','story':{'title':'Kept','body_md':'Kept'},'position':0,'provenance':original['stories']}],
        'residences':[{'key':'res','person_key':'a','residence':{'place':'Kept'},'provenance':original['residences']}]}
    stage=c.post(BASE+'/imports',data={'expected_graph_revision':'1'},files={'file':('tree.json',json.dumps(manifest).encode(),'application/json')});assert stage.status_code==200
    result=c.post(BASE+f'/imports/{stage.json()["id"]}/commit',json={'expected_graph_revision':1,'idempotency_key':'provenance','confirmed':True});assert result.status_code==200
    with factory() as s:
        source=s.scalar(select(FamilyTreeImportSourceKey).where(FamilyTreeImportSourceKey.source_key=='a'));source_id=source.person_id
        assert set(source.provenance['records'])==set(groups)
        for group in groups:assert next(iter(source.provenance['records'][group].values()))==original[group]
    def exported():
        exp=c.post(BASE+'/exports',json={'format':'json'});assert exp.status_code==200
        data=c.get(BASE+f'/exports/{exp.json()["id"]}/download').json()
        for group in groups:assert data[group][0]['provenance']==original[group]
    exported()
    assert merge(c,source_id,target,2).status_code==200
    from test_family_tree_recovery_review import purge_person
    purge_person(c,source_id,3,'alias-provenance')
    with factory() as s:
        retained=s.scalar(select(FamilyTreeImportSourceKey).where(FamilyTreeImportSourceKey.person_id==target))
        assert set(retained.provenance['records'])==set(groups)
    exported()
