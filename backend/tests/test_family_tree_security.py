import pytest
from sqlalchemy import select,func,update
from app.models import User,AuthSession,Module,HouseholdModuleAccess,UserModuleAccess
from app.models.family_tree import FamilyTreeCollection,FamilyTreePerson,FamilyTreeMutationReceipt,FamilyTreeStory,FamilyTreeParentLink
from test_family_tree_api import tree,create,person_id,BASE

@pytest.mark.parametrize('tree',[True],indirect=True)
def test_api_persistence_on_real_migrated_schema(tree):
    c,factory,ids=tree
    a=person_id(create(c,birth_date={'value':'2000-02-29','uncertain':True},tags=['Research'],aliases=[{'name':'Other'}]))
    b=person_id(create(c,1,'B','b'))
    assert c.post(BASE+'/parent-links',json={'expected_graph_revision':2,'parent_person_id':a,'child_person_id':b,'kind':'step'}).status_code==200
    result=c.post(BASE+f'/people/{a}/stories',json={'expected_graph_revision':3,'idempotency_key':'story','story':{'title':'Title','body_md':'Text','source_url':'https://example.test/source'}})
    assert result.status_code==200
    story_id=result.json()['affected']['story_ids'][0]
    with factory() as s:
        assert s.scalar(select(func.count()).select_from(FamilyTreePerson))==2
        assert s.get(FamilyTreeStory,story_id).facts['body_md']=='Text'
        assert s.scalar(select(FamilyTreeCollection.revision))==4
    c.cookies.clear()
    login=c.post('/chore-api/auth/login',json={'email':'parent@example.test','password':'password123'})
    c.headers['X-CSRF-Token']=login.json()['csrf_token']
    assert c.get(BASE+f'/people/{a}').json()['person']['birth_date']['uncertain'] is True
    assert c.get(BASE+f'/people/{a}/stories').json()['items'][0]['id']==story_id


def seed_all(c):
    a=person_id(create(c));b=person_id(create(c,1,'B','b'));rev=2
    relations={}
    for kind,payload in [('parent-links',{'parent_person_id':a,'child_person_id':b,'kind':'biological'}),('care-links',{'caregiver_person_id':a,'recipient_person_id':b,'kind':'guardian'}),('partner-episodes',{'person_a_id':a,'person_b_id':b,'kind':'partners'})]:
        result=c.post(BASE+'/'+kind,json={'expected_graph_revision':rev,**payload})
        assert result.status_code==200
        relations[kind]=result.json()['affected']['relationship_ids'][0];rev+=1
    records={}
    for kind,payload,key in [('stories',{'story':{'title':'X','body_md':'Y'},'idempotency_key':'story'},'story_ids'),('residences',{'residence':{'place':'X'}},'residence_ids')]:
        result=c.post(BASE+f'/people/{a}/{kind}',json={'expected_graph_revision':rev,**payload})
        assert result.status_code==200
        records[kind]=result.json()['affected'][key][0];rev+=1
    requests=[('GET',f'/people/{a}',None),('GET',f'/people/{a}/stories',None),('GET',f'/people/{a}/residences',None),('GET',f'/graph?focus_person_id={a}',None),('GET',f'/compare?person_a_id={a}&person_b_id={b}',None),('PATCH',f'/people/{a}',{'changes':{'gender':None}}),('POST',f'/people/{a}/archive',{}),('POST',f'/people/{a}/restore',{}),('POST',f'/people/{a}/lock',{'reason':'R'}),('POST',f'/people/{a}/unlock',{'reason':'R'}),('POST',f'/people/{a}/stories',{'idempotency_key':'story2','story':{'title':'X','body_md':'Y'}}),('POST',f'/people/{a}/residences',{'residence':{'place':'X'}}),('POST',f'/people/{a}/stories/reorder',{'story_ids':[records['stories']]}),('PUT',f'/people/{a}/identity-link',{'user_id':2,'confirmed':True}),('DELETE',f'/people/{a}/identity-link',{}),('POST','/relatives',{'idempotency_key':'rel','anchor_person_id':a,'person':{'display_name':'R'},'relationship':{'direction':'child','kind':'step'}})]
    for kind,rid in relations.items():
        changes={'notes_md':'changed'}
        requests.extend([('PATCH',f'/{kind}/{rid}',{'changes':changes}),('DELETE',f'/{kind}/{rid}',{})])
    for kind,rid in records.items():
        changes={'body_md':'changed'} if kind=='stories' else {'place':'Changed'}
        requests.extend([('PATCH',f'/{kind}/{rid}',{'changes':changes}),('DELETE',f'/{kind}/{rid}',{})])
    return a,b,rev,requests


def test_cross_household_endpoint_matrix_and_no_revision_changes(tree):
    c,factory,_=tree
    a,b,rev,requests=seed_all(c)
    login=c.post('/chore-api/auth/login',json={'email':'other@example.test','password':'password123'})
    c.headers['X-CSRF-Token']=login.json()['csrf_token']
    for method,path,payload in requests:
        result=c.request(method,BASE+path,json={'expected_graph_revision':0,**payload} if payload is not None else None)
        assert result.status_code==404,(method,path,result.text)
    for kind,payload in [('parent-links',{'parent_person_id':a,'child_person_id':b,'kind':'step'}),('care-links',{'caregiver_person_id':a,'recipient_person_id':b,'kind':'guardian'}),('partner-episodes',{'person_a_id':a,'person_b_id':b,'kind':'partners'})]:
        result=c.post(BASE+'/'+kind,json={'expected_graph_revision':0,**payload})
        assert result.status_code==404
    with factory() as s:
        revisions=list(s.scalars(select(FamilyTreeCollection.revision)))
        assert revisions==[rev]


def test_all_routes_wrong_role_view_only_csrf_anonymous_and_revoked(tree):
    c,factory,ids=tree
    a,b,rev,requests=seed_all(c)
    with factory() as s:
        s.add(UserModuleAccess(user_id=ids['owner'],module_key='family-tree',can_view=True,can_manage=False));s.commit()
    for method,path,payload in requests:
        if method=='GET':continue
        result=c.request(method,BASE+path,json={'expected_graph_revision':rev,**payload})
        assert result.status_code==403,(method,path,result.text)
    assert c.get(BASE+'/identity-candidates').status_code==403
    with factory() as s:
        s.get(UserModuleAccess,{'user_id':ids['owner'],'module_key':'family-tree'}).can_manage=True;s.commit()
    del c.headers['X-CSRF-Token']
    assert create(c,rev,'Unauthorized','csrf').status_code==403
    c.cookies.clear()
    assert c.get(BASE+'/').status_code==401
    login=c.post('/chore-api/auth/login',json={'email':'child@example.test','password':'password123'});c.headers['X-CSRF-Token']=login.json()['csrf_token']
    with factory() as s:
        s.add(UserModuleAccess(user_id=ids['child_user'],module_key='family-tree',can_view=True,can_manage=True));s.commit()
    for method,path,payload in requests:
        result=c.request(method,BASE+path,json={'expected_graph_revision':rev,**payload} if payload is not None else None)
        assert result.status_code==403,(method,path,result.text)
    c.cookies.clear();login=c.post('/chore-api/auth/login',json={'email':'parent@example.test','password':'password123'})
    c.headers['X-CSRF-Token']=login.json()['csrf_token']
    with factory() as s:
        s.get(User,ids['parent']).session_generation+=1;s.commit()
    assert c.get(BASE+'/').status_code==401
    with factory() as s:assert s.scalar(select(FamilyTreeCollection.revision))==rev


def test_lock_matrix_old_record_endpoints_and_partner_normalization(tree):
    c,factory,_=tree
    a,b,rev,requests=seed_all(c)
    assert c.post(BASE+f'/people/{a}/lock',json={'expected_graph_revision':rev,'reason':'Locked'}).status_code==200;rev+=1
    for method,path,payload in requests:
        if method=='GET' or path.endswith('/lock') or path.endswith('/unlock'):continue
        result=c.request(method,BASE+path,json={'expected_graph_revision':rev,**payload})
        assert result.status_code==409 and result.json()['detail']['code']=='person_locked',(path,result.text)
    assert c.get(BASE+'/').json()['graph_revision']==rev


def test_receipts_have_no_family_body_and_replay_current_revision(tree):
    c,factory,_=tree
    person_id(create(c,notes_md='Sensitive story',birth_date={'value':'1984'}))
    person_id(create(c,1,'B','b'))
    result=create(c,notes_md='Sensitive story',birth_date={'value':'1984'}).json()
    assert result['replayed'] and result['committed_revision']==1 and result['current_revision']==2
    with factory() as s:
        receipt=s.scalar(select(FamilyTreeMutationReceipt).where(FamilyTreeMutationReceipt.operation=='person.create'))
        assert 'Sensitive story' not in str(receipt.result) and '1984' not in str(receipt.result)
        assert len(receipt.body_digest)==64
    result=c.get(BASE+'/')
    assert 'no-store' in result.headers['Cache-Control']
    assert result.headers['Referrer-Policy']=='no-referrer'


def test_graph_read_has_real_sqlite_snapshot_across_concurrent_commit(tree,monkeypatch):
    c,factory,ids=tree
    a=person_id(create(c))
    from app.services.family_tree import graph
    original=graph.load
    def interleaved(session,actor,history=True):
        result=original(session,actor,history)
        with factory() as writer:
            writer.execute(update(FamilyTreeCollection).where(FamilyTreeCollection.household_id==ids['household']).values(revision=2));writer.commit()
        return result
    monkeypatch.setattr(graph,'load',interleaved)
    result=c.get(BASE+'/graph',params={'focus_person_id':a}).json()
    assert result['graph_revision']==1
    assert c.get(BASE+'/').json()['graph_revision']==2


def test_cached_person_cannot_bypass_a_new_lock(tree):
    c,factory,ids=tree
    a=person_id(create(c))
    from app.schemas.family_tree import PatchPerson
    from app.services.family_tree.mutations import execute
    from app.services.family_tree import people
    from fastapi import HTTPException
    with factory() as stale:
        actor=stale.get(User,ids['owner']);cached=stale.get(FamilyTreePerson,a)
        assert cached.is_locked is False
        assert c.post(BASE+f'/people/{a}/lock',json={'expected_graph_revision':1,'reason':'New lock'}).status_code==200
        body=PatchPerson(expected_graph_revision=2,changes={'gender':'Must not change'})
        with pytest.raises(HTTPException) as conflict:
            execute(stale,actor,f'person.patch:{a}',body,lambda col:people.edit(stale,actor,col,a,body.changes))
        assert conflict.value.detail['code']=='person_locked'
    assert c.get(BASE+'/').json()['graph_revision']==2


def test_story_retry_and_parent_identity_lifecycle(tree):
    c,factory,ids=tree
    a=person_id(create(c))
    payload={'expected_graph_revision':1,'idempotency_key':'story-retry','story':{'title':'Title','body_md':'Body'}}
    first=c.post(BASE+f'/people/{a}/stories',json=payload)
    assert first.status_code==200
    result=c.post(BASE+f'/people/{a}/stories',json=payload).json()
    assert result['replayed'] and result['committed_revision']==2
    with factory() as s:assert s.scalar(select(func.count()).select_from(FamilyTreeStory))==1
    assert c.put(BASE+f'/people/{a}/identity-link',json={'expected_graph_revision':2,'user_id':ids['child_user'],'confirmed':True}).status_code==422
    assert c.put(BASE+f'/people/{a}/identity-link',json={'expected_graph_revision':2,'user_id':ids['parent'],'confirmed':True}).status_code==200
    with factory() as s:
        s.get(User,ids['parent']).active=False;s.commit()
    detail=c.get(BASE+f'/people/{a}').json()
    assert detail['identity_link']['active'] is False and detail['graph_revision']==4
    with factory() as s:s.delete(s.get(User,ids['parent']));s.commit()
    detail=c.get(BASE+f'/people/{a}').json()
    assert detail['identity_link'] is None and detail['graph_revision']==5
    assert detail['person']['display_name']=='Morgan'


@pytest.mark.parametrize('role',['PLATFORM_OWNER','PLATFORM_SUPPORT'])
def test_real_platform_session_never_grants_household_content(tree,role):
    c,factory,_=tree
    from app.models.platform import PlatformUser
    from app.models.enums import PlatformRole
    from app.security.platform_sessions import create_platform_session,OPS_SESSION_COOKIE_NAME
    with factory() as s:
        ops=PlatformUser(email=role.lower()+'@example.test',password_hash='unused',role=PlatformRole(role),totp_secret_ciphertext='unused-in-session-only-fixture',totp_key_version='unused')
        s.add(ops);s.flush();token,csrf,_=create_platform_session(s,ops.id);s.commit()
    c.cookies.clear();c.cookies.set(OPS_SESSION_COOKIE_NAME,token)
    assert c.get('/ops-api/auth/me').status_code==200
    for path in ['/','/people','/people/1','/identity-candidates','/graph?focus_person_id=1','/compare?person_a_id=1&person_b_id=2']:
        assert c.get(BASE+path).status_code==401
    assert create(c).status_code==401


def test_expired_receipt_window_does_not_replay_forever(tree):
    c,factory,_=tree
    person_id(create(c))
    from datetime import UTC,datetime,timedelta
    with factory() as s:
        receipt=s.scalar(select(FamilyTreeMutationReceipt));receipt.expires_at=datetime.now(UTC)-timedelta(seconds=1);s.commit()
    result=create(c,1).json()
    assert result['replayed'] is False and result['committed_revision']==2
    with factory() as s:assert s.scalar(select(func.count()).select_from(FamilyTreeMutationReceipt))==1
