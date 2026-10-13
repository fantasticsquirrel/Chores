"""FT-3 migration preservation and logical count boundary regressions."""
from pathlib import Path
import json

import pytest
from alembic import command
from alembic.config import Config
from fastapi import HTTPException
from sqlalchemy import select
from app.config import get_settings
from app.db import get_engine, get_session_factory
from app.models import Household, User
from app.models.family_tree import FamilyTreeCollection, FamilyTreePerson, FamilyTreeStory, FamilyTreeMediaAsset, FamilyTreeIdentityLink
from app.schemas.family_tree import PersonCreate, StoryData
from app.services.family_tree import people, portable


def test_logical_people_limit_is_resource_error():
    manifest={'schema_version':1,'producer':'fixture','exported_at':'2026-10-13','collection_title':'Fixture','snapshot_revision':0,
        'people':[{'key':f'p:{n}','person':{'display_name':'Synthetic'}} for n in range(5001)]}
    with pytest.raises(HTTPException) as failure: portable.decode(json.dumps(manifest).encode())
    assert failure.value.status_code==413
    assert failure.value.detail['code']=='resource_limit'


def test_password_confirmation_preserves_exact_secret():
    from app.schemas.family_tree_transfer import PurgePreview
    password='  deliberate spaces  '
    assert PurgePreview(expected_graph_revision=1,password=password).password==password


def test_ft3_upgrade_preserves_nonempty_ft1(tmp_path,monkeypatch):
    url='sqlite:///'+str(tmp_path/'prior-ft1.sqlite')
    monkeypatch.setenv('APP_ENV','test');monkeypatch.setenv('DATABASE_URL',url);monkeypatch.setenv('SECRET_KEY','a'*32)
    get_settings.cache_clear();get_engine.cache_clear();get_session_factory.cache_clear()
    backend=Path(__file__).resolve().parents[1]
    cfg=Config(str(backend/'alembic.ini'));cfg.set_main_option('script_location',str(backend/'alembic'))
    command.upgrade(cfg,'20261013_0022')
    factory=get_session_factory(url)
    with factory() as s:
        s.add(Household(id=501,name='Synthetic prior',owner_user_id=601));s.flush()
        s.add(User(id=601,household_id=501,email='fixture@example.test',password_hash='unused',role='PARENT_ADMIN'));s.flush()
        collection=FamilyTreeCollection(household_id=501,revision=7,created_by_user_id=601);s.add(collection);s.flush()
        person=FamilyTreePerson(household_id=501,collection_id=collection.id,created_by_user_id=601)
        people.save_facts(person,PersonCreate(display_name='Preserved',birth_date={'value':'1984-02','uncertain':True}));s.add(person);s.flush()
        story=FamilyTreeStory(household_id=501,collection_id=collection.id,person_id=person.id,position=3,created_by_user_id=601,facts=StoryData(title='Preserved story',body_md='**Body**').model_dump(mode='json'))
        s.add(story);s.add(FamilyTreeIdentityLink(household_id=501,collection_id=collection.id,person_id=person.id,user_id=601,created_by_user_id=601))
        s.commit();pid=person.id;sid=story.id;cid=collection.id
    command.upgrade(cfg,'head')
    with factory() as s:
        assert s.get(FamilyTreePerson,pid).facts['display_name']=='Preserved'
        assert s.get(FamilyTreePerson,pid).facts['birth_date']['uncertain']
        assert s.get(FamilyTreeStory,sid).facts['body_md']=='**Body**'
        assert s.get(FamilyTreeStory,sid).position==3
        assert s.get(FamilyTreeCollection,cid).revision==7
        assert s.scalar(select(FamilyTreeIdentityLink).where(FamilyTreeIdentityLink.person_id==pid)).user_id==601
        assert s.scalar(select(FamilyTreeMediaAsset.id)) is None
    # Database-level metadata parity, including the new scoped story key, is
    # independently checked by the foundation migration regression.
