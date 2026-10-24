"""Isolated real predecessor merge producer and current forward repair readback."""
import json
import os
from pathlib import Path
import sqlite3
import sys
from types import SimpleNamespace

BACKEND = Path.cwd().resolve()
sys.path[:0] = [str(BACKEND), str(BACKEND / 'tests')]
# Import only the neutral driver helpers from current tests after frozen fixtures.
sys.path.append(str(Path(__file__).resolve().parent))
from alias_upgrade_probe import BASE, UNKNOWN, append, cfg, export, login, snapshot
from alembic import command
from pytest import MonkeyPatch
from sqlalchemy import select

QUOTED = {'status': 'known', 'source_label': ' Paper register ',
          'created_at': '1901-02-03T04:05:06Z', 'attribution': ' Original recorder '}


def aliases(manifest, pid):
    return next(p['person']['aliases'] for p in manifest['people'] if p['key'] == f'p:{pid}')


def seed(directory, evidence):
    import test_family_tree_api as fixture
    from test_family_tree_ft3 import merge
    from app.models.family_tree import FamilyTreeOtherName as Name, FamilyTreeImportSourceKey as Source, FamilyTreeMutationReceipt as Receipt
    assert Path(fixture.__file__).resolve().is_relative_to(BACKEND / 'tests')
    assert 'portable_provenance' not in Name.__table__.c
    command.upgrade(cfg(), 'head')
    mp = MonkeyPatch()
    gen = fixture.tree.__wrapped__(directory, mp, SimpleNamespace(param=False))
    c, factory, ids = next(gen)
    try:
        duplicate = {'name': 'Imported alias', 'label': 'Duplicate citation'}
        original = fixture.person_id(fixture.create(c, aliases=[duplicate, duplicate]))
        r = c.post(BASE + f'/people/{original}/stories', json={'expected_graph_revision': 1,
            'idempotency_key': 'story', 'story': {'title': 'Imported story', 'body_md': 'Synthetic text'}})
        assert r.status_code == 200, r.text
        r = c.post(BASE + f'/people/{original}/residences', json={'expected_graph_revision': 2,
            'residence': {'place': 'Synthetic place', 'is_primary': True}})
        assert r.status_code == 200, r.text
        package = export(c)
        # A valid caller-controlled key resembles a generated merge key. It is
        # still an append origin: actual receipt semantics must decide.
        key = package['people'][0]['key']
        package['people'][0]['key'] = 'merge:caller-controlled'
        package['default_focus_key'] = 'merge:caller-controlled'
        for group in ['stories', 'residences']:
            for row in package[group]:
                if row['person_key'] == key:
                    row['person_key'] = 'merge:caller-controlled'
        login(c, 'other@example.test')
        target = fixture.person_id(fixture.create(c, name='Canonical', aliases=[{'name': 'Genuine prior local'}]))
        imported = append(c, package, 1, 'import-with-records')
        r = c.patch(BASE + f'/people/{imported}', json={'expected_graph_revision': 2,
            'changes': {'aliases': [duplicate, duplicate, duplicate, {'name': 'Genuine later source local'}]}})
        assert r.status_code == 200, r.text
        r = merge(c, imported, target, 3, 'merge-with-records')
        assert r.status_code == 200, r.text
        target_aliases = c.get(BASE + f'/people/{target}').json()['person']['aliases']
        r = c.patch(BASE + f'/people/{target}', json={'expected_graph_revision': 4,
            'changes': {'aliases': [{'name': a['name'], 'label': a['label']} for a in target_aliases]
                       + [{'name': 'Genuine postmerge local'}]}})
        assert r.status_code == 200, r.text
        detail = {str(pid): c.get(BASE + f'/people/{pid}').json()['person']['aliases'] for pid in [target, imported]}
        with factory() as s:
            source = s.scalar(select(Source).where(Source.person_id == imported))
            target_source = s.scalar(select(Source).where(Source.person_id == target))
            receipt = s.scalar(select(Receipt).where(Receipt.operation.like('import:%')))
            assert target_source.provenance['records']['stories']
            assert target_source.provenance['records']['residences']
            assert receipt.result['affected']['person_ids'] == [imported]
            ordering = {'source': source.created_at.isoformat(), 'import_end': receipt.created_at.isoformat(),
                        'target_source': target_source.created_at.isoformat()}
            if evidence == 'missing-receipt':
                s.delete(receipt)
            elif evidence == 'missing-source':
                s.delete(source)
            elif evidence == 'missing-audit':
                from app.models import SecurityAuditEvent
                event = s.scalar(select(SecurityAuditEvent).where(
                    SecurityAuditEvent.household_id == ids['other_household'],
                    SecurityAuditEvent.event_type == 'family_tree.person.patch'))
                assert event is not None
                s.delete(event)
            s.commit()
        (directory / 'info.json').write_text(json.dumps({'target': target, 'imported': imported,
            'evidence': evidence, 'detail': detail, 'ordering': ordering}))
    finally:
        gen.close()
        mp.undo()


def add_explicit_histories(c, directory):
    """Actual S2 append creates explicit portable entries, including duplicates."""
    login(c, 'parent@example.test')
    package = export(c)
    package['people'] = [package['people'][0]]
    key = package['people'][0]['key']
    package['default_focus_key'] = key
    for group in ['stories', 'residences', 'parent_links', 'care_links', 'partner_episodes', 'media', 'media_references']:
        package[group] = []
    package['people'][0]['person']['aliases'] = [
        {'name': 'Quoted portable', 'label': None, 'provenance': QUOTED},
        {'name': 'Explicit unknown', 'label': None, 'provenance': UNKNOWN}]
    login(c, 'other@example.test')
    revision = c.get(BASE + '/').json()['graph_revision']
    return append(c, package, revision, 'explicit-s2-history')


def verify(directory, start):
    from fastapi.testclient import TestClient
    from app.main import create_app
    info = json.loads((directory / 'info.json').read_text())
    # Snapshot at 26 permits strict unchanged DDL/all operational values even
    # for the fresh predecessor path. 27 is genuinely populated before 28.
    command.upgrade(cfg(), '20261013_0026')
    with TestClient(create_app()) as c:
        explicit = add_explicit_histories(c, directory)
        # These genuinely portable entries are inserted later than the first
        # source import fence, then copied to the same native target. A repair
        # must exclude their append origin BEFORE restoring local histories.
        from test_family_tree_ft3 import merge
        revision = c.get(BASE + '/').json()['graph_revision']
        r = merge(c, explicit, info['target'], revision, 'merge-explicit-histories')
        assert r.status_code == 200, r.text
        target_detail = c.get(BASE + f'/people/{info["target"]}').json()['person']['aliases']
    if start == '27':
        command.upgrade(cfg(), '20261013_0027')
    before = snapshot()
    command.upgrade(cfg(), '20261013_0028')
    after = snapshot()
    # The current test API creates all registered metadata at its 0026 setup,
    # including the four retained tables and Discovery Lab. Preserve the 79-table
    # snapshot at the historical 0028 repair boundary, not a stale 71 count.
    assert len(before) == 79 and before.keys() == after.keys()
    for table, old in before.items():
        if table != 'family_tree_other_names':
            assert old == after[table], table
        else:
            assert old['ddl'] == after[table]['ddl'] and old['columns'] == after[table]['columns']
            assert [r[:-1] for r in old['rows']] == [r[:-1] for r in after[table]['rows']]
    # Preserve the original 0028 equality above, then require exact additive head.
    command.upgrade(cfg(), 'head')
    newest = snapshot()
    retained = {'homeschool_courses', 'homeschool_lessons', 'homeschool_course_assignments', 'homeschool_lesson_progress'}
    assert set(newest) == set(after) | retained | {"discovery_exploration_access", "discovery_packages", "discovery_package_versions", "discovery_package_grants"}
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
    for table in ('discovery_exploration_access', 'discovery_packages', 'discovery_package_versions', 'discovery_package_grants'):
        assert newest[table]['rows'] == []
    for table in retained:
        assert newest[table]['rows'] == []
    command.check(cfg())
    with sqlite3.connect(os.environ['DATABASE_URL'].removeprefix('sqlite:///')) as db:
        assert not db.execute('PRAGMA foreign_key_check').fetchall()
    with TestClient(create_app()) as c:
        login(c, 'other@example.test')
        exported = export(c)
        for pid in [info['target'], info['imported'], explicit]:
            ordinary = c.get(BASE + f'/people/{pid}').json()
            assert ordinary['identity_link'] is None
            assert all(set(a) == {'id', 'name', 'label', 'created_by_user_id', 'created_at'} for a in ordinary['person']['aliases'])
            if pid != explicit:
                expected = target_detail if pid == info['target'] else info['detail'][str(pid)]
                assert ordinary['person']['aliases'] == expected
        rows = aliases(exported, info['target'])
        source_rows = aliases(exported, info['imported'])
        explicit_rows = aliases(exported, explicit)
        assert [a['provenance'] for a in explicit_rows] == [QUOTED, UNKNOWN]
        assert [a['provenance'] for a in rows if a['name'] in {'Quoted portable', 'Explicit unknown'}] == [QUOTED, UNKNOWN]
        duplicates = [a for a in rows if a['name'] == 'Imported alias']
        assert len(duplicates) == 3
        assert all(a['provenance'] == UNKNOWN for a in duplicates[:2])
        assert duplicates[2]['provenance']['status'] == ('known' if info['evidence'] == 'intact' else 'unknown')
        if info['evidence'] == 'intact':
            assert next(a['provenance'] for a in source_rows if a['name'] == 'Genuine later source local')['status'] == 'known'
            locals_ = {'Genuine prior local', 'Genuine later source local', 'Genuine postmerge local'}
            assert all(a['provenance']['status'] == 'known' for a in rows if a['name'] in locals_)
        else:
            # The bounded forward repair does not fabricate destroyed evidence.
            assert next(a['provenance'] for a in rows if a['name'] == 'Genuine later source local') == UNKNOWN
        login(c, 'parent@example.test')
        revision = c.get(BASE + '/').json()['graph_revision']
        hop = append(c, exported, revision, 'roundtrip-origin-repair')
        assert aliases(export(c), hop) == rows
        assert c.get(BASE + f'/people/{hop}').json()['identity_link'] is None
    result = {'start': start, 'evidence': info['evidence'], 'tables': len(before),
              'target': rows, 'retained_source': source_rows, 'explicit': explicit_rows, 'ordering': info['ordering']}
    (directory / 'observed.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result))


if __name__ == '__main__':
    mode, directory, option = sys.argv[1:]
    (seed if mode == 'seed' else verify)(Path(directory), option)
