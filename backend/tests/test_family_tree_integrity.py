"""Database invariants, concurrency, rollout and negative command matrix."""
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC,datetime
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi import HTTPException
from sqlalchemy import select,text,func
from sqlalchemy.exc import IntegrityError

from test_family_tree_api import tree,create,person_id,BASE
from app.models import User,Child,Module,HouseholdModuleAccess,SecurityAuditEvent
from app.models.family_tree import *
from app.schemas.family_tree import CreateParent,CreatePerson
from app.services.family_tree.mutations import execute
from app.services.family_tree import relationships,people


def test_new_catalog_disabled_missing_rows_and_disable_reenable(tree):
    c,factory,ids=tree
    p=person_id(create(c))
    with factory() as s:
        row=s.get(Module,'family-tree');row.enabled=False;s.commit()
    assert c.get(BASE+'/').status_code==403
    with factory() as s:
        s.get(Module,'family-tree').enabled=True;s.commit()
    assert c.get(BASE+f'/people/{p}').status_code==200
    with factory() as s:
        row=s.get(HouseholdModuleAccess,{'household_id':ids['household'],'module_key':'family-tree'});row.enabled=False;s.commit()
    assert c.get(BASE+'/').status_code==403
    with factory() as s:
        s.get(HouseholdModuleAccess,{'household_id':ids['household'],'module_key':'family-tree'}).enabled=True;s.commit()
    assert c.get(BASE+f'/people/{p}').status_code==200
    with factory() as s:
        s.delete(s.get(Module,'family-tree'));s.commit()
        from app.services.modules import ModuleService
        ModuleService().ensure_catalog(s)
        assert s.get(Module,'family-tree').enabled is False

@pytest.mark.parametrize('value',['0000','10000','1900-02-29','2023-02-29','2020-13','2020-00','2020-01-01T00:00:00Z'])
def test_invalid_date_no_rows(tree,value):
    c,factory,_=tree
    assert create(c,birth_date={'value':value}).status_code==422
    assert c.get(BASE+'/').json()['graph_revision']==0

@pytest.mark.parametrize('body',['<script>alert(1)</script>','![image](https://example.test/i)','[unsafe](javascript:alert)','[unsafe](data:text/plain,x)','[unsafe](%6aavascript:alert)','[link][id]\n[id]: javascript:alert'])
def test_markdown_rejects_active_content(tree,body):
    c,_,_=tree
    assert create(c,notes_md=body).status_code==422

def test_uninitialized_validation_rolls_back_collection(tree):
    c,factory,_=tree
    assert c.post(BASE+'/relatives',json={'expected_graph_revision':0,'idempotency_key':'no-orphan','anchor_person_id':999,'relationship':{'direction':'child','kind':'biological'},'person':{'display_name':'new'}}).status_code==404
    with factory() as s:
        assert s.scalar(select(func.count()).select_from(FamilyTreeCollection))==0
        assert s.scalar(select(func.count()).select_from(FamilyTreePerson))==0

@pytest.mark.parametrize('model,values',[(FamilyTreePersonTag,{'person_id':1,'tag':'x'}),(FamilyTreeStory,{'person_id':1,'facts':{},'position':0}),(FamilyTreeResidence,{'person_id':1,'facts':{}}),(FamilyTreeParentLink,{'parent_person_id':1,'child_person_id':1,'kind':'biological','facts':{}}),(FamilyTreeCareLink,{'caregiver_person_id':1,'recipient_person_id':1,'kind':'guardian','facts':{}}),(FamilyTreePartnerEpisode,{'person_a_id':1,'person_b_id':2,'kind':'partners','facts':{}})])
def test_composite_person_fk_rejects_cross_household(tree,model,values):
    c,factory,ids=tree
    person_id(create(c))
    with factory() as s:
        other=FamilyTreeCollection(household_id=ids['other_household'],revision=1);s.add(other);s.flush()
        s.add(model(household_id=ids['other_household'],collection_id=other.id,created_by_user_id=ids['outsider'],**values))
        with pytest.raises(IntegrityError):s.flush()
        s.rollback()

def test_identity_composite_fk_and_duplicate_targets(tree):
    c,factory,ids=tree
    a=person_id(create(c));b=person_id(create(c,1,'B','b'))
    assert c.put(BASE+f'/people/{a}/identity-link',json={'expected_graph_revision':2,'user_id':ids['parent'],'confirmed':True}).status_code==200
    response=c.put(BASE+f'/people/{b}/identity-link',json={'expected_graph_revision':3,'user_id':ids['parent'],'confirmed':True})
    assert response.status_code==409 and response.json()['detail']['code']=='identity_link_conflict'
    with factory() as s:
        col=s.scalar(select(FamilyTreeCollection).where(FamilyTreeCollection.household_id==ids['household']))
        s.add(FamilyTreeIdentityLink(household_id=ids['household'],collection_id=col.id,person_id=b,user_id=ids['outsider']))
        with pytest.raises(IntegrityError):s.flush()
        s.rollback()
    assert c.get(BASE+'/').json()['graph_revision']==3

@pytest.mark.parametrize('method,path,body',[('PATCH','/people/{a}',{'changes':{'first_name':'write'}}),('POST','/people/{a}/restore',{}),('POST','/people/{a}/archive',{}),('POST','/people/{a}/lock',{'reason':'reason'}),('POST','/people/{a}/unlock',{'reason':'reason'}),('POST','/people/{a}/stories',{'idempotency_key':'story','story':{'title':'X','body_md':'Y'}}),('POST','/people/{a}/residences',{'residence':{'place':'X'}}),('PUT','/people/{a}/identity-link',{'child_id':1,'confirmed':True}),('DELETE','/people/{a}/identity-link',{}),('POST','/parent-links',{'parent_person_id':1,'child_person_id':2,'kind':'step'}),('POST','/care-links',{'caregiver_person_id':1,'recipient_person_id':2,'kind':'guardian'}),('POST','/partner-episodes',{'person_a_id':1,'person_b_id':2,'kind':'partners'})])
def test_alias_mutations_never_redirect(tree,method,path,body):
    c,factory,_=tree
    a=person_id(create(c));b=person_id(create(c,1,'Target','b'))
    with factory() as s:
        alias=s.get(FamilyTreePerson,a);alias.archived_at=datetime.now(UTC);alias.merged_into_person_id=b;s.commit()
    response=c.request(method,BASE+path.format(a=a),json={'expected_graph_revision':2,**body})
    assert response.status_code==409 and response.json()['detail']['code']=='person_merged'
    assert c.get(BASE+f'/people/{a}').json()['canonical_person']['id']==b
    assert c.get(BASE+f'/people/{b}').json()['person']['display_name']=='Target'
    assert c.get(BASE+'/').json()['graph_revision']==2

def test_flat_alias_fk_restrict_and_no_chain(tree):
    c,factory,_=tree
    a=person_id(create(c));b=person_id(create(c,1,'B','b'));cc=person_id(create(c,2,'C','c'))
    with factory() as s:
        row=s.get(FamilyTreePerson,a);row.archived_at=datetime.now(UTC);row.merged_into_person_id=b;s.commit()
        row=s.get(FamilyTreePerson,b);row.archived_at=datetime.now(UTC);row.merged_into_person_id=cc
        with pytest.raises(IntegrityError):s.flush()
        s.rollback()
        s.delete(s.get(FamilyTreePerson,b))
        with pytest.raises(IntegrityError):s.flush()
        s.rollback()

def test_concurrent_opposing_parent_links_serialize(tree):
    c,factory,ids=tree
    a=person_id(create(c));b=person_id(create(c,1,'B','b'))
    def command_fn(pair):
        with factory() as s:
            actor=s.get(User,ids['owner']);body=CreateParent(expected_graph_revision=2,parent_person_id=pair[0],child_person_id=pair[1],kind='biological')
            try:
                execute(s,actor,'parent-links.post',body,lambda col:relationships.change(s,actor,col,'parent-links',data=body));s.commit();return 'ok'
            except HTTPException as exc:
                return exc.detail['code']
    with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(command_fn,[(a,b),(b,a)]))
    assert sorted(results)==['ok','revision_conflict']
    with factory() as s: assert s.scalar(select(func.count()).select_from(FamilyTreeParentLink))==1
    assert c.get(BASE+'/').json()['graph_revision']==3

def test_concurrent_same_key_first_create_replays(tree):
    _,factory,ids=tree
    def command_fn(_):
        with factory() as s:
            actor=s.get(User,ids['owner']);body=CreatePerson(expected_graph_revision=0,idempotency_key='same',person={'display_name':'Concurrent'})
            def action(col):
                p,w=people.add(s,actor,col,body.person);return {'person_ids':[p.id]},w
            result=execute(s,actor,'person.create',body,action);s.commit();return result
    with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(command_fn,[1,2]))
    assert {r['committed_revision'] for r in results}=={1}
    assert sum(r['replayed'] for r in results)==1
    with factory() as s:
        assert s.scalar(select(func.count()).select_from(FamilyTreePerson))==1
        audit=s.scalar(select(SecurityAuditEvent).where(SecurityAuditEvent.event_type=='family_tree.person.create'))
        assert 'Concurrent' not in audit.details_json

def test_fresh_and_previous_head_migration_disables_catalog(tmp_path,monkeypatch):
    root=Path(__file__).resolve().parents[1]
    monkeypatch.setenv('APP_ENV','test');monkeypatch.setenv('SECRET_KEY','a'*32)
    for previous in [False,True]:
        url=f'sqlite:///{tmp_path / str(previous)}.sqlite';monkeypatch.setenv('DATABASE_URL',url)
        from app.config import get_settings
        from app.db import get_engine,get_session_factory
        get_settings.cache_clear();get_engine.cache_clear();get_session_factory.cache_clear()
        cfg=Config(str(root/'alembic.ini'));cfg.set_main_option('script_location',str(root/'alembic'))
        if previous:
            command.upgrade(cfg,'20261005_0021')
            from app.models import Household,UserModuleAccess
            with get_session_factory(url)() as s:
                h=Household(id=501,name='Existing synthetic household',owner_user_id=601);s.add(h);s.flush()
                s.add(User(id=601,household_id=501,email='existing@example.test',role='PARENT_ADMIN',password_hash='unused'));s.flush()
                if s.get(Module,'recipes') is None:s.add(Module(key='recipes',name='Recipes',description='Existing module',enabled=True));s.flush()
                s.add(HouseholdModuleAccess(household_id=501,module_key='recipes',enabled=False))
                s.add(UserModuleAccess(user_id=601,module_key='recipes',can_view=True,can_manage=False));s.commit()
        command.upgrade(cfg,'20261013_0028')
        with get_session_factory(url)() as s:
            module=s.get(Module,'family-tree')
            assert module is not None and module.enabled is False
            assert s.scalar(select(func.count()).select_from(FamilyTreePerson))==0
            if previous:
                from app.models import UserModuleAccess
                assert s.get(HouseholdModuleAccess,{'household_id':501,'module_key':'family-tree'}).enabled is False
                assert s.get(HouseholdModuleAccess,{'household_id':501,'module_key':'recipes'}).enabled is False
                assert s.get(UserModuleAccess,{'user_id':601,'module_key':'recipes'}).can_manage is False
        with pytest.raises(RuntimeError,match='disable-only'):command.downgrade(cfg,'20261005_0021')
        with get_session_factory(url)() as s:
            assert s.execute(text('SELECT version_num FROM alembic_version')).scalar_one()=='20261013_0028'
        command.upgrade(cfg,'head')
        with get_session_factory(url)() as s:
            assert s.execute(text('SELECT version_num FROM alembic_version')).scalar_one()=='20261014_0029'
        # Whole-schema parity is required; historical DDL remains unchanged.
        from alembic.autogenerate import compare_metadata
        from alembic.migration import MigrationContext
        from app.db import Base
        with get_engine(url).connect() as connection:
            context=MigrationContext.configure(connection)
            assert compare_metadata(context,Base.metadata)==[]


def test_merged_person_cannot_replay_an_old_person_command(tree):
    c,factory,_=tree
    a=person_id(create(c));b=person_id(create(c,1,'B','b'))
    payload={'expected_graph_revision':2,'idempotency_key':'patch','changes':{'gender':'entered'}}
    assert c.patch(BASE+f'/people/{a}',json=payload).status_code==200
    with factory() as s:
        row=s.get(FamilyTreePerson,a);row.archived_at=datetime.now(UTC);row.merged_into_person_id=b;s.commit()
    result=c.patch(BASE+f'/people/{a}',json=payload)
    assert result.status_code==409 and result.json()['detail']['code']=='person_merged'


def test_relative_inapplicable_dates_do_not_silently_disappear(tree):
    c,_,_=tree
    a=person_id(create(c))
    result=c.post(BASE+'/relatives',json={'expected_graph_revision':1,'idempotency_key':'invalid','anchor_person_id':a,'person':{'display_name':'B'},'relationship':{'direction':'parent','kind':'biological','start_date':{'value':'2020'}}})
    assert result.status_code==422
    assert c.get(BASE+'/people').json()['total']==1


def test_other_name_attribution_survives_patch_and_creator_deletion(tree):
    c,factory,ids=tree
    p=person_id(create(c,aliases=[{'name':'Other','label':'research'}]))
    aliases=c.get(BASE+f'/people/{p}').json()['person']['aliases']
    assert aliases[0]['created_by_user_id']==ids['owner']
    assert c.patch(BASE+f'/people/{p}',json={'expected_graph_revision':1,'changes':{'gender':'entered'}}).status_code==200
    assert c.get(BASE+f'/people/{p}').json()['person']['aliases']==aliases
    # Removal of creator attribution must not delete names or genealogy.
    with factory() as s:
        from app.models import Household
        s.get(Household,ids['household']).owner_user_id=ids['parent'];s.flush()
        s.delete(s.get(User,ids['owner']));s.commit()
    login=c.post('/chore-api/auth/login',json={'email':'parent@example.test','password':'password123'})
    c.headers['X-CSRF-Token']=login.json()['csrf_token']
    aliases=c.get(BASE+f'/people/{p}').json()['person']['aliases']
    assert aliases[0]['name']=='Other' and aliases[0]['created_by_user_id'] is None


def test_noop_patch_and_chronology_review_are_explicit(tree):
    c,_,_=tree
    p=person_id(create(c))
    assert c.patch(BASE+f'/people/{p}',json={'expected_graph_revision':1,'changes':{'display_name':'Morgan'}}).status_code==422
    result=c.patch(BASE+f'/people/{p}',json={'expected_graph_revision':1,'changes':{'birth_date':{'value':'2000','uncertain':True},'death_date':{'value':'1900'}}})
    assert result.status_code==422 and result.json()['detail']['code']=='chronology_review'
    assert c.get(BASE+'/').json()['graph_revision']==1
    assert c.patch(BASE+f'/people/{p}',json={'expected_graph_revision':1,'reviewed_warnings':['chronology_review'],'changes':{'birth_date':{'value':'2000','uncertain':True},'death_date':{'value':'1900'}}}).status_code==200


def test_corrupt_cycle_graph_is_bounded_and_warned(tree):
    c,factory,ids=tree
    a=person_id(create(c));b=person_id(create(c,1,'B','b'))
    with factory() as s:
        col=s.scalar(select(FamilyTreeCollection))
        for parent,child in [(a,b),(b,a)]:s.add(FamilyTreeParentLink(household_id=ids['household'],collection_id=col.id,parent_person_id=parent,child_person_id=child,kind='step'))
        s.commit()
    result=c.get(BASE+'/graph',params={'focus_person_id':a,'up_depth':10,'down_depth':10}).json()
    assert len(result['nodes'])==2 and 'stored_ancestry_cycle' in result['warnings']
