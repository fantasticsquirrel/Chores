"""Fresh-process predecessor/API upgrade probe; never mixes application modules."""
import json
import os
from pathlib import Path
import sqlite3
import sys
from types import SimpleNamespace

# The driver lives in current tests, but fixtures/application modules must come
# from the subprocess's chosen checkout, including during predecessor seeding.
CHECKOUT_BACKEND = Path.cwd().resolve()
sys.path[:0] = [str(CHECKOUT_BACKEND), str(CHECKOUT_BACKEND / 'tests')]

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from pytest import MonkeyPatch
from sqlalchemy import select

BASE = '/chore-api/family-tree'
UNKNOWN = {'status': 'unknown', 'source_label': None, 'created_at': None, 'attribution': None}


def cfg():
    import app
    root = Path(app.__file__).resolve().parents[1]
    config = Config(str(root / 'alembic.ini'))
    config.set_main_option('script_location', str(root / 'alembic'))
    return config


def login(c, email):
    r = c.post('/chore-api/auth/login', json={'email': email, 'password': 'password123'})
    assert r.status_code == 200, r.text
    c.headers['X-CSRF-Token'] = r.json()['csrf_token']


def export(c):
    r = c.post(BASE + '/exports', json={'format': 'json'})
    assert r.status_code == 200, r.text
    r = c.get(BASE + f'/exports/{r.json()["id"]}/download')
    assert r.status_code == 200, r.text
    return r.json()


def append(c, manifest, revision, key):
    r = c.post(BASE + '/imports', data={'expected_graph_revision': str(revision)},
               files={'file': ('tree.json', json.dumps(manifest).encode(), 'application/json')})
    assert r.status_code == 200, r.text
    r = c.post(BASE + f'/imports/{r.json()["id"]}/commit', json={
        'expected_graph_revision': revision, 'idempotency_key': key, 'confirmed': True})
    assert r.status_code == 200, r.text
    return r.json()['affected']['person_ids'][0]


def snapshot():
    with sqlite3.connect(os.environ['DATABASE_URL'].removeprefix('sqlite:///')) as c:
        tables = c.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='alembic_version' ORDER BY name").fetchall()
        return {name: {'ddl': ddl, 'columns': [r[1] for r in c.execute(f'PRAGMA table_info("{name}")')],
                       'rows': c.execute(f'SELECT * FROM "{name}" ORDER BY rowid').fetchall()}
                for name, ddl in tables}


def seed(directory, evidence):
    # Import exclusively from the verified predecessor's backend/tests.
    import test_family_tree_api as fixture
    assert Path(fixture.__file__).resolve().is_relative_to(CHECKOUT_BACKEND / 'tests')
    tree, create, person_id = fixture.tree, fixture.create, fixture.person_id
    from app.models.family_tree import FamilyTreeOtherName as Name, FamilyTreeImportSourceKey as Source, FamilyTreeMutationReceipt as Receipt
    assert 'portable_provenance' not in Name.__table__.c
    command.upgrade(cfg(), 'head')
    from alembic.script import ScriptDirectory
    assert ScriptDirectory.from_config(cfg()).get_current_head() == '20261013_0025'
    mp = MonkeyPatch()
    gen = tree.__wrapped__(directory, mp, SimpleNamespace(param=False))
    c, factory, ids = next(gen)
    try:
        duplicate = {'name': 'Duplicate', 'label': 'Same citation'}
        sentinel = {'name': 'Genuine later local', 'label': 'Entered after import'}
        original = person_id(create(c, aliases=[duplicate, duplicate]))
        manifest = export(c)
        assert all('provenance' not in a for a in manifest['people'][0]['person']['aliases'])
        login(c, 'other@example.test')
        imported = append(c, manifest, 0, 'legacy-import')
        with factory() as s:
            source = s.scalar(select(Source).where(Source.person_id == imported))
            rows = list(s.scalars(select(Name).where(Name.person_id == imported).order_by(Name.position)))
            receipt = s.scalar(select(Receipt).where(Receipt.operation.like('import:%')))
            assert receipt is not None
            # Actual insertion order is recorded, not assumed from Source time.
            ordering = {'source': source.created_at.isoformat(), 'aliases': [r.created_at.isoformat() for r in rows], 'receipt': receipt.created_at.isoformat()}
            assert all(r.created_at <= receipt.created_at for r in rows)
        r = c.patch(BASE + f'/people/{imported}', json={'expected_graph_revision': 1,
            'changes': {'aliases': [duplicate, duplicate, duplicate, sentinel]}})
        assert r.status_code == 200, r.text
        with factory() as s:
            rows = list(s.scalars(select(Name).where(Name.person_id == imported).order_by(Name.position)))
            assert len(rows) == 4
            assert all(r.created_by_user_id == ids['outsider'] for r in rows)
            assert all(r.created_at > receipt.created_at for r in rows[2:])
        if evidence == 'cleanup':
            with factory() as s:
                from app.models.family_tree import FamilyTreeTransferJob
                s.query(Receipt).delete(synchronize_session=False)
                s.query(FamilyTreeTransferJob).delete(synchronize_session=False)
                s.commit()
        elif evidence == 'deleted':
            from app.models import User, Household
            from app.models.enums import UserRole
            from app.security import hash_password
            with factory() as s:
                replacement = User(household_id=ids['other_household'], email='replacement@example.test', role=UserRole.PARENT_ADMIN, password_hash=hash_password('password123'))
                s.add(replacement); s.flush()
                s.get(Household, ids['other_household']).owner_user_id = replacement.id
                s.flush(); s.delete(s.get(User, ids['outsider'])); s.commit()
        info = {'imported': imported, 'original': original, 'evidence': evidence, 'ordering': ordering}
        (directory / 'info.json').write_text(json.dumps(info))
    finally:
        gen.close(); mp.undo()


def verify(directory, start):
    from app.config import get_settings
    from app.db import get_session_factory
    from app.main import create_app
    from app.models.family_tree import FamilyTreeOtherName as Name
    info = json.loads((directory / 'info.json').read_text())
    if start == '26':
        command.upgrade(cfg(), '20261013_0026')
        # Exercise actual S2 imports while 0026 is populated, before repair.
        with TestClient(create_app()) as c:
            login(c, 'parent@example.test')
            revision = c.get(BASE + '/').json()['graph_revision']
            r = c.post(BASE + '/people', json={'expected_graph_revision': revision,
                'idempotency_key': 'fresh-26', 'person': {'display_name': 'Fresh S2',
                'aliases': [{'name': 'Quoted'}, {'name': 'Unavailable'}]}})
            assert r.status_code == 200, r.text
            pid = r.json()['affected']['person_ids'][0]
            fresh = export(c)
            fresh['people'] = [p for p in fresh['people'] if p['key'] == f'p:{pid}']
            fresh['default_focus_key'] = f'p:{pid}'
            quoted = {'status': 'known', 'source_label': ' Paper register ',
                      'created_at': '1901-02-03T04:05:06Z', 'attribution': ' Original recorder '}
            fresh['people'][0]['person']['aliases'][0]['provenance'] = quoted
            fresh['people'][0]['person']['aliases'][1]['provenance'] = UNKNOWN
            login(c, 'replacement@example.test' if info['evidence'] == 'deleted' else 'other@example.test')
            revision = c.get(BASE + '/').json()['graph_revision']
            fresh_imported = append(c, fresh, revision, 'fresh-26-import')
    before = snapshot()
    command.upgrade(cfg(), '20261013_0028')
    with sqlite3.connect(os.environ['DATABASE_URL'].removeprefix('sqlite:///')) as c:
        assert not c.execute('PRAGMA foreign_key_check').fetchall()
    after = snapshot()
    assert before.keys() == after.keys()
    repaired = 0
    for table, old in before.items():
        new = after[table]
        if table != 'family_tree_other_names':
            assert new == old, table
            continue
        assert new['columns'] == old['columns'] + ([] if start == '26' else ['portable_provenance'])
        if start == '26':
            assert new['ddl'] == old['ddl']
        assert len(new['rows']) == len(old['rows'])
        for previous, current in zip(old['rows'], new['rows'], strict=True):
            assert current[:-1] == (previous[:-1] if start == '26' else previous)
            if start == '26' and previous[-1] is not None:
                assert current[-1] == previous[-1], 'Existing S2 history/local marker changed'
            elif current[-1] is not None:
                assert json.loads(current[-1]) == UNKNOWN
                repaired += 1
    assert repaired == (2 if info['evidence'] == 'intact' else 4)
    with sqlite3.connect(os.environ['DATABASE_URL'].removeprefix('sqlite:///')) as c:
        assert c.execute('SELECT version_num FROM alembic_version').fetchone()[0] == '20261013_0028'
    # Keep the original repair boundary exact, then check the additive new head.
    command.upgrade(cfg(), 'head')
    newest = snapshot()
    retained = {'homeschool_courses', 'homeschool_lessons', 'homeschool_course_assignments', 'homeschool_lesson_progress'}
    assert set(newest) == set(after) | retained | {"discovery_exploration_access"}
    for table, old in after.items():
        if table in {"modules", "household_module_access"}:
            assert newest[table]['ddl'] == old['ddl'], table
            assert newest[table]['columns'] == old['columns'], table
            assert all(row in newest[table]['rows'] for row in old['rows']), table
            added = [row for row in newest[table]['rows'] if row not in old['rows']]
            records = [dict(zip(old['columns'], row)) for row in added]
            if table == 'household_module_access':
                household_ids = {dict(zip(after['households']['columns'], row))['id'] for row in after['households']['rows']}
                existing_ids = {dict(zip(old['columns'], row))['household_id'] for row in old['rows'] if dict(zip(old['columns'], row))['module_key'] == 'discovery-lab'}
                assert {row['household_id'] for row in records} == household_ids - existing_ids
                assert all(row['module_key'] == 'discovery-lab' and row['enabled'] == 0 for row in records)
            else:
                assert len(records) <= 1
                assert all(row['key'] == 'discovery-lab' and row['enabled'] == 1 for row in records)
        else:
            assert newest[table] == old, table
    assert newest['discovery_exploration_access']['rows'] == []
    for table in retained:
        assert newest[table]['rows'] == []
    command.check(cfg())  # Real UNFILTERED schema check, on both upgrade paths.
    factory = get_session_factory(get_settings().database_url)
    with TestClient(create_app()) as c:
        login(c, 'replacement@example.test' if info['evidence'] == 'deleted' else 'other@example.test')
        def aliases(manifest, pid):
            return next(p['person']['aliases'] for p in manifest['people'] if p['key'] == f'p:{pid}')
        exported = export(c)
        if start == '26':
            assert [a['provenance'] for a in aliases(exported, fresh_imported)] == [quoted, UNKNOWN]
        rows = aliases(exported, info['imported'])
        assert all(a['provenance'] == UNKNOWN for a in rows[:2])
        if info['evidence'] == 'intact':
            assert all(a['provenance']['status'] == 'known' for a in rows[2:])
            detail = c.get(BASE + f'/people/{info["imported"]}').json()['person']['aliases']
            assert [a['provenance']['created_at'] for a in rows[2:]] == [a['created_at'] for a in detail[2:]]
        else:
            assert all(a['provenance'] == UNKNOWN for a in rows)
        # A new ordinary alias must stay provably local without timestamp guesses.
        ordinary = [{'name': a['name'], 'label': a['label']} for a in rows] + [{'name': 'Post-repair local'}]
        revision = c.get(BASE + '/').json()['graph_revision']
        r = c.patch(BASE + f'/people/{info["imported"]}', json={'expected_graph_revision': revision, 'changes': {'aliases': ordinary}})
        assert r.status_code == 200, r.text
        assert aliases(export(c), info['imported'])[-1]['provenance']['status'] == 'known'
        with factory() as s:
            new = s.scalar(select(Name).where(Name.person_id == info['imported'], Name.name == 'Post-repair local'))
            assert new.portable_provenance == {'origin': 'local'}
        login(c, 'parent@example.test')
        revision = c.get(BASE + '/').json()['graph_revision']
        hop = append(c, exported, revision, 'reexport-import')
        assert aliases(export(c), hop) == rows
        assert c.get(BASE + f'/people/{hop}').json()['identity_link'] is None
    print(json.dumps({'tables_preserved': len(before), 'repaired': repaired, 'start': start, 'evidence': info['evidence'], 'ordering': info['ordering']}))


if __name__ == '__main__':
    mode, target, option = sys.argv[1:]
    if mode == 'seed':
        seed(Path(target), option)
    else:
        verify(Path(target), option)
