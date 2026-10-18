"""Reduced operator policy preserves source ceilings and fails before publication."""
import asyncio
import json
import pytest
from fastapi import HTTPException
from test_family_tree_ft3 import tree, ft3, create, person_id, BASE
from app.services.family_tree import portable, storage


def package(**groups):
    return {'schema_version':1,'producer':'test','exported_at':'test','collection_title':'Test','snapshot_revision':0,'media_omitted':True,**groups}


@pytest.mark.parametrize('name,group', [('PEOPLE','people'),('FACTS','care_links'),('RECORDS','stories'),('MEDIA','media'),('REFERENCES','media_references')])
def test_policy_rejects_raw_counts_before_pydantic(monkeypatch,name,group):
    monkeypatch.setenv('FAMILY_TREE_MAX_'+name,'1')
    with pytest.raises(HTTPException) as caught:
        portable.decode(json.dumps(package(**{group:[{},{}]})).encode())
    assert caught.value.status_code == 413


def test_manifest_byte_policy_before_json(monkeypatch):
    monkeypatch.setenv('FAMILY_TREE_MANIFEST_MAX_BYTES','2')
    with pytest.raises(HTTPException) as caught: portable.decode(b'not json')
    assert caught.value.status_code == 413


def test_original_defaults_and_invalid_increases(monkeypatch):
    assert storage.collection_limits() == {'people':5000,'facts':20000,'records':40000,'media':1000,'references':40000}
    monkeypatch.setenv('FAMILY_TREE_MAX_PEOPLE','5001')
    with pytest.raises(HTTPException) as caught: storage.collection_limits()
    assert caught.value.status_code == 503


def test_reduced_import_and_export_leave_no_jobs_or_files(ft3,monkeypatch):
    c,factory,_=ft3
    person_id(create(c));person_id(create(c,1,'Second','second'))
    monkeypatch.setenv('FAMILY_TREE_MAX_PEOPLE','1')
    from app.models.family_tree import FamilyTreeTransferJob
    from sqlalchemy import select,func
    r=c.post(BASE+'/exports',json={'format':'json'})
    assert r.status_code==413,r.text
    raw=json.dumps(package(people=[{'key':'a','person':{'display_name':'A'}},{'key':'b','person':{'display_name':'B'}}])).encode()
    r=c.post(BASE+'/imports',data={'expected_graph_revision':'2'},files={'file':('tree.json',raw,'application/json')})
    assert r.status_code==413,r.text
    with factory() as s: assert s.scalar(select(func.count()).select_from(FamilyTreeTransferJob))==0
    for area in ('objects','artifacts','staging'): assert not list((storage.root()/area).iterdir())


def test_incremental_writes_share_transfer_policy(ft3,monkeypatch):
    c,_,_=ft3
    a=person_id(create(c));b=person_id(create(c,1,'Second','second'))
    monkeypatch.setenv('FAMILY_TREE_MAX_PEOPLE','2')
    assert create(c,2,'Third','third').status_code==413
    monkeypatch.setenv('FAMILY_TREE_MAX_FACTS','1')
    first=c.post(BASE+'/care-links',json={'expected_graph_revision':2,'caregiver_person_id':a,'recipient_person_id':b,'kind':'caregiver'})
    assert first.status_code==200
    assert c.post(BASE+'/partner-episodes',json={'expected_graph_revision':3,'person_a_id':a,'person_b_id':b,'kind':'partners'}).status_code==413
    monkeypatch.setenv('FAMILY_TREE_MAX_RECORDS','1')
    assert c.post(BASE+f'/people/{a}/stories',json={'expected_graph_revision':3,'idempotency_key':'story','story':{'title':'T','body_md':'Text'}}).status_code==200
    assert c.post(BASE+f'/people/{b}/residences',json={'expected_graph_revision':4,'residence':{'place':'P'}}).status_code==413
    assert c.get(BASE+'/').json()['graph_revision']==4
    assert c.post(BASE+'/exports',json={'format':'json'}).status_code==200


def test_attachment_policy_preserves_exportability(ft3,monkeypatch):
    from test_family_tree_ft3 import upload
    c,_,_=ft3
    a=person_id(create(c));b=person_id(create(c,1,'Second','second'))
    first=upload(c).json()['id'];second=upload(c).json()['id']
    monkeypatch.setenv('FAMILY_TREE_MAX_MEDIA','1')
    monkeypatch.setenv('FAMILY_TREE_MAX_REFERENCES','1')
    assert c.post(BASE+f'/media/{first}/attach',json={'expected_graph_revision':2,'person_id':a,'role':'gallery'}).status_code==200
    for asset in (first,second):
        response=c.post(BASE+f'/media/{asset}/attach',json={'expected_graph_revision':3,'person_id':b,'role':'gallery'})
        assert response.status_code==413
    assert c.get(BASE+'/').json()['graph_revision']==3
    assert c.post(BASE+'/exports',json={'format':'zip'}).status_code==200


def test_single_heavy_admission(monkeypatch):
    from app.security.family_tree_limits import FamilyTreeBodyLimitMiddleware
    monkeypatch.setenv('FAMILY_TREE_TRANSFER_WORKERS','1')
    entered=asyncio.Event();release=asyncio.Event();sent=[]
    async def app(scope,receive,send):
        entered.set();await release.wait();await send({'type':'http.response.start','status':200,'headers':[]})
    async def receive(): return {'type':'http.request','body':b''}
    async def send(event): sent.append(event)
    async def run():
        middleware=FamilyTreeBodyLimitMiddleware(app)
        scope={'type':'http','path':BASE+'/exports','method':'POST','headers':[]}
        task=asyncio.create_task(middleware(scope,receive,send));await entered.wait()
        try: await asyncio.wait_for(middleware(scope,receive,send),timeout=1)
        finally:
            release.set();await task
    asyncio.run(run())
    assert [e['status'] for e in sent if e['type']=='http.response.start']==[503,200]
