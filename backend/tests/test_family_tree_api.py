from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func

from app.config import get_settings
from app.db import initialize_database, get_session_factory
from app.main import create_app
from app.models import Household, User, Child, Module, HouseholdModuleAccess, UserModuleAccess
from app.models.enums import UserRole
from app.security import hash_password
from app.services.modules import ModuleService

BASE = '/chore-api/family-tree'

@pytest.fixture
def tree(tmp_path, monkeypatch, request):
    monkeypatch.setenv('APP_ENV', 'test')
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path / "tree.sqlite"}')
    monkeypatch.setenv('SECRET_KEY', 'a' * 32)
    monkeypatch.setenv('SESSION_COOKIE_SECURE', 'false')
    get_settings.cache_clear()
    if getattr(request,'param',False):
        from alembic import command
        from alembic.config import Config
        root=Path(__file__).resolve().parents[1]
        config=Config(str(root/'alembic.ini'));config.set_main_option('script_location',str(root/'alembic'))
        command.upgrade(config,'head')
    initialize_database(get_settings())
    factory = get_session_factory(get_settings().database_url)
    with factory() as s:
        h = Household(name='Synthetic',owner_user_id=1); other = Household(name='Other',owner_user_id=4)
        s.add_all([h, other]); s.flush()
        users = [User(household_id=h.id, email=f'{role.value.lower()}@example.test', role=role, password_hash=hash_password('password123')) for role in [UserRole.PARENT_ADMIN, UserRole.PARENT]]
        child = Child(household_id=h.id, name='Child'); s.add(child); s.flush()
        users.append(User(household_id=h.id, email='child@example.test', role=UserRole.CHILD, child_id=child.id, password_hash=hash_password('password123')))
        outsider = User(household_id=other.id, email='other@example.test', role=UserRole.PARENT_ADMIN, password_hash=hash_password('password123'))
        s.add_all(users + [outsider]); s.flush(); h.owner_user_id = users[0].id; other.owner_user_id = outsider.id
        ModuleService().ensure_catalog(s)
        row = s.get(Module, 'family-tree')
        if row is not None:
            row.enabled = True
            s.add_all([HouseholdModuleAccess(household_id=i, module_key='family-tree', enabled=True) for i in [h.id, other.id]])
        s.commit()
        ids = {'household': h.id, 'owner': users[0].id, 'parent': users[1].id, 'child': child.id, 'child_user': users[2].id, 'other_household': other.id, 'outsider': outsider.id}
    with TestClient(create_app()) as client:
        login = client.post('/chore-api/auth/login', json={'email': 'PARENT_ADMIN@example.test', 'password': 'password123'})
        assert login.status_code == 200
        client.headers['X-CSRF-Token'] = login.json()['csrf_token']
        yield client, factory, ids

def create(c, rev=0, name='Morgan', key='first', **fields):
    return c.post(BASE + '/people', json={'expected_graph_revision': rev, 'idempotency_key': key, 'person': {'display_name': name, **fields}})

def person_id(response):
    assert response.status_code == 200, response.text
    return response.json()['affected']['person_ids'][0]

def test_uninitialized_read_no_write_and_atomic_first_person(tree):
    c, factory, _ = tree
    state = c.get(BASE + '/')
    assert state.status_code == 200
    assert state.json()['graph_revision'] == 0
    with factory() as s:
        from app.models.family_tree import FamilyTreeCollection
        assert s.scalar(select(func.count()).select_from(FamilyTreeCollection)) == 0
    p = person_id(create(c))
    assert c.get(BASE + '/').json()['default_focus_person_id'] == p
    assert c.get(BASE + f'/people/{p}').json()['person']['display_name'] == 'Morgan'

def test_patch_roundtrip_revision_idempotency_and_validation(tree):
    c, factory, ids = tree
    payload = dict(first_name='M', middle_name='Middle', last_name=None, maiden_name='Earlier', suffix='Jr', aliases=[{'name':'Alias','label':'Other'}], gender='entered', birth_date={'value':'1984-02','uncertain':True}, living_status='unknown', notes_md='**safe**', tags=['Research'])
    response = create(c, **payload); p = person_id(response)
    replay = create(c, **payload).json()
    assert replay['replayed'] and replay['committed_revision'] == 1
    assert create(c, name='Changed').status_code == 409
    bad = c.patch(BASE + f'/people/{p}', json={'expected_graph_revision':1,'changes':{'birth_date':{'value':'1900-02-29'}}})
    assert bad.status_code == 422
    ok = c.patch(BASE + f'/people/{p}', json={'expected_graph_revision':1,'changes':{'gender':None,'tags':['Research','review']}})
    assert ok.status_code == 200
    assert c.patch(BASE + f'/people/{p}', json={'expected_graph_revision':1,'changes':{'first_name':'stale'}}).json()['detail']['code'] == 'revision_conflict'
    person = c.get(BASE + f'/people/{p}').json()['person']
    assert person['gender'] is None and person['middle_name'] == 'Middle'
    assert person['birth_date'] == {'value':'1984-02','precision':'month','uncertain':True}
    assert c.get(BASE + '/people', params={'query':'Alias'}).json()['items'][0]['id'] == p
    assert c.patch(BASE + f'/people/{p}', json={'expected_graph_revision':2,'changes':{'household_id':ids['other_household']}}).status_code == 422

def test_relative_cycle_atomicity_and_lock(tree):
    c, factory, _ = tree
    a = person_id(create(c))
    relative = c.post(BASE + '/relatives', json={'expected_graph_revision':1,'idempotency_key':'relative','anchor_person_id':a,'relationship':{'direction':'child','kind':'adoptive'},'person':{'first_name':'B'}})
    assert relative.status_code == 200
    b = next(pid for pid in relative.json()['affected']['person_ids'] if pid != a)
    cycle = c.post(BASE + '/parent-links', json={'expected_graph_revision':2,'parent_person_id':b,'child_person_id':a,'kind':'step'})
    assert cycle.status_code == 409 and cycle.json()['detail']['code'] == 'relationship_cycle', cycle.text
    assert c.get(BASE + '/').json()['graph_revision'] == 2
    assert c.post(BASE + f'/people/{a}/lock', json={'expected_graph_revision':2,'reason':'review'}).status_code == 200
    for path, payload in [(f'/people/{a}/archive',{}),(f'/people/{a}/stories',{'idempotency_key':'s','story':{'title':'T','body_md':'Body'}}),('/parent-links',{'parent_person_id':a,'child_person_id':b,'kind':'biological'})]:
        result = c.post(BASE + path, json={'expected_graph_revision':3, **payload})
        assert result.status_code == 409 and result.json()['detail']['code'] == 'person_locked'
    failed = c.post(BASE + '/relatives', json={'expected_graph_revision':3,'idempotency_key':'failed','anchor_person_id':a,'relationship':{'direction':'parent','kind':'biological'},'person':{'first_name':'Orphan'}})
    assert failed.status_code == 409
    assert c.get(BASE + '/people').json()['total'] == 2
    assert c.post(BASE + f'/people/{a}/unlock', json={'expected_graph_revision':3,'reason':'Reviewed'}).status_code == 200
    assert c.post(BASE + f'/people/{a}/archive', json={'expected_graph_revision':4}).status_code == 200
    assert c.get(BASE + '/people').json()['total'] == 1
    assert c.post(BASE + f'/people/{a}/restore', json={'expected_graph_revision':5}).status_code == 200

def test_story_residence_crud_reorder_and_identity_lifecycle(tree):
    c, factory, ids = tree
    p = person_id(create(c)); rev = 1; stories = []
    for key in ['story1','story2']:
        result = c.post(BASE + f'/people/{p}/stories', json={'expected_graph_revision':rev,'idempotency_key':key,'story':{'title':key,'body_md':'Content','date':{'value':'2020'}}})
        assert result.status_code == 200; stories.append(result.json()['affected']['story_ids'][0]); rev += 1
    assert c.post(BASE + f'/people/{p}/stories/reorder', json={'expected_graph_revision':rev,'story_ids':list(reversed(stories))}).status_code == 200; rev += 1
    assert [s['id'] for s in c.get(BASE + f'/people/{p}/stories').json()['items']] == list(reversed(stories))
    assert c.patch(BASE + f'/stories/{stories[0]}', json={'expected_graph_revision':rev,'changes':{'body_md':'Edited'}}).status_code == 200; rev += 1
    assert c.request('DELETE', BASE + f'/stories/{stories[1]}', json={'expected_graph_revision':rev}).status_code == 200; rev += 1
    residences=[]
    for place in ['First','Second']:
        result=c.post(BASE+f'/people/{p}/residences',json={'expected_graph_revision':rev,'residence':{'place':place,'is_primary':True}})
        assert result.status_code==200; residences.append(result.json()['affected']['residence_ids'][0]); rev+=1
    assert sum(r['is_primary'] for r in c.get(BASE+f'/people/{p}/residences').json()['items'])==1
    assert c.patch(BASE+f'/residences/{residences[0]}',json={'expected_graph_revision':rev,'changes':{'notes_md':'changed'}}).status_code==200; rev+=1
    assert c.request('DELETE',BASE+f'/residences/{residences[0]}',json={'expected_graph_revision':rev}).status_code==200; rev+=1
    assert c.put(BASE+f'/people/{p}/identity-link',json={'expected_graph_revision':rev,'child_id':ids['child'],'confirmed':True}).status_code==200; rev+=1
    with factory() as s:
        child=s.get(Child,ids['child']); child.active=False; s.commit()
    detail=c.get(BASE+f'/people/{p}').json()
    assert detail['graph_revision']==rev+1 and detail['identity_link']['active'] is False; rev+=1
    with factory() as s:
        s.delete(s.get(User, ids['child_user'])); s.flush(); s.delete(s.get(Child,ids['child'])); s.commit()
    detail=c.get(BASE+f'/people/{p}').json()
    assert detail['identity_link'] is None and detail['person']['display_name']=='Morgan'

def test_rollout_security_tenant_and_replay_authority(tree):
    c, factory, ids = tree
    p=person_id(create(c))
    with factory() as s:
        s.add(UserModuleAccess(user_id=ids['owner'],module_key='family-tree',can_view=True,can_manage=False)); s.commit()
    assert c.get(BASE+'/').status_code==200
    assert create(c).status_code==403
    with factory() as s:
        row=s.get(HouseholdModuleAccess,{'household_id':ids['household'],'module_key':'family-tree'}); s.delete(row); s.commit()
    assert c.get(BASE+'/').status_code==403
    with factory() as s:
        ModuleService().ensure_catalog(s)
        s.add(HouseholdModuleAccess(household_id=ids['household'],module_key='family-tree',enabled=True)); s.commit()
    login=c.post('/chore-api/auth/login',json={'email':'other@example.test','password':'password123'}); c.headers['X-CSRF-Token']=login.json()['csrf_token']
    assert c.get(BASE+f'/people/{p}').status_code==404
    login=c.post('/chore-api/auth/login',json={'email':'child@example.test','password':'password123'}); c.headers['X-CSRF-Token']=login.json()['csrf_token']
    with factory() as s:
        s.add(UserModuleAccess(user_id=ids['child_user'],module_key='family-tree',can_view=True,can_manage=True)); s.commit()
    assert c.get(BASE+'/').status_code==403
