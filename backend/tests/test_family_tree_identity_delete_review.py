"""Identity eligibility must not intercept attribution-only FK deletion actions."""
import pytest
from alembic import command
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from test_family_tree_api import tree, create, person_id, BASE
from test_schema_alignment_review import cfg
from app.config import get_settings
from app.db import get_engine
from app.models import User, Household
from app.models.family_tree import FamilyTreeCollection, FamilyTreeIdentityLink, FamilyTreePerson


def link(client, pid, user_id, revision=1):
    response = client.put(BASE + f'/people/{pid}/identity-link', json={
        'expected_graph_revision': revision, 'user_id': user_id, 'confirmed': True,
    })
    assert response.status_code == 200


@pytest.mark.parametrize('tree', [False, True], indirect=True)
def test_self_created_identity_link_does_not_block_account_deletion(tree):
    client, factory, ids = tree
    login = client.post('/chore-api/auth/login', json={
        'email': 'PARENT@example.test', 'password': 'password123',
    })
    assert login.status_code == 200
    client.headers['X-CSRF-Token'] = login.json()['csrf_token']
    pid = person_id(create(client))
    link(client, pid, ids['parent'])
    with factory() as session:
        association = session.scalar(select(FamilyTreeIdentityLink))
        assert association.user_id == association.created_by_user_id == ids['parent']
        collection = session.scalar(select(FamilyTreeCollection))
        collection_id, before = collection.id, collection.revision
        session.execute(text('DELETE FROM users WHERE id=:id'), {'id': ids['parent']})
        session.commit()
    with factory() as session:
        assert session.get(User, ids['parent']) is None
        assert session.scalar(select(FamilyTreeIdentityLink)) is None
        person = session.get(FamilyTreePerson, pid)
        assert person is not None and person.created_by_user_id is None
        assert person.facts['display_name'] == 'Morgan'
        collection = session.get(FamilyTreeCollection, collection_id)
        assert collection.created_by_user_id is None
        assert collection.revision == before + 1
        assert session.get(Household, ids['household']).owner_user_id == ids['owner']
        assert session.execute(text('PRAGMA foreign_key_check')).all() == []
    owner_login = client.post('/chore-api/auth/login', json={
        'email': 'PARENT_ADMIN@example.test', 'password': 'password123',
    })
    assert owner_login.status_code == 200
    client.headers['X-CSRF-Token'] = owner_login.json()['csrf_token']
    detail = client.get(BASE + f'/people/{pid}')
    assert detail.status_code == 200
    assert detail.json()['identity_link'] is None
    assert detail.json()['person']['display_name'] == 'Morgan'
    assert detail.json()['graph_revision'] == before + 1


@pytest.mark.parametrize('tree', [False, True], indirect=True)
def test_narrow_update_preserves_insert_and_target_scope_eligibility(tree):
    client, factory, ids = tree
    pid = person_id(create(client))
    second = person_id(create(client, 1, 'Second', 'second'))
    link(client, pid, ids['parent'], 2)
    with factory() as session:
        association = session.scalar(select(FamilyTreeIdentityLink))
        association_id, collection_id = association.id, association.collection_id
        revision = session.get(FamilyTreeCollection, collection_id).revision
    for invalid in [ids['child_user'], ids['outsider']]:
        with factory() as session:
            with pytest.raises(IntegrityError, match='identity target must be an adult'):
                session.execute(text('UPDATE family_tree_identity_links SET user_id=:target WHERE id=:id'),
                                {'target': invalid, 'id': association_id})
            session.rollback()
            assert session.get(FamilyTreeIdentityLink, association_id).user_id == ids['parent']
            assert session.get(FamilyTreeCollection, collection_id).revision == revision
        with factory() as session:
            session.add(FamilyTreeIdentityLink(
                person_id=second, collection_id=collection_id, household_id=ids['household'],
                user_id=invalid, created_by_user_id=ids['owner'],
            ))
            with pytest.raises(IntegrityError, match='identity target must be an adult'):
                session.flush()
            session.rollback()
    with factory() as session:
        with pytest.raises(IntegrityError, match='identity target must be an adult'):
            session.execute(text('UPDATE family_tree_identity_links SET household_id=:household WHERE id=:id'),
                            {'household': ids['other_household'], 'id': association_id})
        session.rollback()
        assert session.get(FamilyTreeIdentityLink, association_id).household_id == ids['household']
        assert session.execute(text('PRAGMA foreign_key_check')).all() == []


@pytest.mark.parametrize('tree', [False, True], indirect=True)
def test_self_link_does_not_weaken_household_owner_delete_restriction(tree):
    client, factory, ids = tree
    pid = person_id(create(client))
    link(client, pid, ids['owner'])
    with factory() as session:
        before = session.scalar(select(FamilyTreeCollection)).revision
        with pytest.raises(IntegrityError, match='current owner cannot be deleted'):
            session.execute(text('DELETE FROM users WHERE id=:id'), {'id': ids['owner']})
            session.commit()
        session.rollback()
    with factory() as session:
        assert session.get(User, ids['owner']) is not None
        assert session.scalar(select(FamilyTreeIdentityLink)).user_id == ids['owner']
        assert session.scalar(select(FamilyTreeCollection)).revision == before
        assert session.get(FamilyTreePerson, pid).created_by_user_id == ids['owner']


def test_previous_head_forward_trigger_repair_preserves_rows_and_schema(tmp_path, monkeypatch):
    url = f'sqlite:///{tmp_path / "identity-upgrade.sqlite"}'
    monkeypatch.setenv('APP_ENV', 'test')
    monkeypatch.setenv('DATABASE_URL', url)
    get_settings.cache_clear()
    command.upgrade(cfg(), '20261013_0024')
    engine = get_engine(url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO households(id,name,timezone,owner_user_id,created_at) VALUES (901,'Fixture','UTC',902,CURRENT_TIMESTAMP)"))
        for uid, role in [(902, 'PARENT_ADMIN'), (903, 'PARENT')]:
            connection.execute(text("INSERT INTO users(id,household_id,email,password_hash,role,active,created_at) VALUES (:id,901,:email,'unused',:role,1,CURRENT_TIMESTAMP)"), {'id': uid, 'email': f'fixture-{uid}@example.test', 'role': role})
        connection.execute(text("INSERT INTO family_tree_collections(id,household_id,title,revision,created_by_user_id,created_at,updated_at) VALUES (904,901,'Fixture',9,903,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
        connection.execute(text("INSERT INTO family_tree_people(id,collection_id,household_id,facts,search_text,is_locked,created_by_user_id,created_at,updated_at) VALUES (905,904,901,'{\"display_name\":\"Preserved\",\"living_status\":\"unknown\"}','preserved',0,903,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
        connection.execute(text("INSERT INTO family_tree_identity_links(id,person_id,user_id,collection_id,household_id,created_by_user_id,created_at,updated_at) VALUES (906,905,903,904,901,903,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
    with engine.connect() as connection:
        tables = dict(connection.execute(text("SELECT name,sql FROM sqlite_master WHERE type='table'")).all())
        rows = {name: connection.execute(text(f'SELECT * FROM "{name}"')).all() for name in tables if name != 'alembic_version'}
    # The trigger-only revision preserves every table definition. Later 0026
    # intentionally adds portable alias history, so keep this assertion pinned
    # to the repair it characterizes, then check the latest unfiltered schema.
    command.upgrade(cfg(), '20261013_0025')
    with engine.connect() as connection:
        assert dict(connection.execute(text("SELECT name,sql FROM sqlite_master WHERE type='table'")).all()) == tables
        for name, expected in rows.items():
            assert connection.execute(text(f'SELECT * FROM "{name}"')).all() == expected, name
        guard = connection.scalar(text("SELECT sql FROM sqlite_master WHERE name='trg_ft_identity_update'"))
        assert 'UPDATE OF user_id, household_id' in guard
    command.upgrade(cfg(), 'head')
    command.check(cfg())
    with engine.connect() as connection:
        for name, expected in rows.items():
            assert connection.execute(text(f'SELECT * FROM "{name}"')).all() == expected, name
        guard = connection.scalar(text("SELECT sql FROM sqlite_master WHERE name='trg_ft_identity_update'"))
        assert 'UPDATE OF user_id, household_id' in guard
    with engine.begin() as connection:
        connection.execute(text('DELETE FROM users WHERE id=903'))
    with engine.connect() as connection:
        assert connection.scalar(text('SELECT count(*) FROM family_tree_identity_links')) == 0
        assert connection.scalar(text('SELECT created_by_user_id FROM family_tree_people WHERE id=905')) is None
        assert connection.scalar(text('SELECT revision FROM family_tree_collections WHERE id=904')) == 10
        assert connection.scalar(text('SELECT count(*) FROM users WHERE id=902')) == 1
        assert connection.execute(text('PRAGMA foreign_key_check')).all() == []
