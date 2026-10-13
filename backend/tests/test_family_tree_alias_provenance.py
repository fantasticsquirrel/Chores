"""Individual portable provenance through real authenticated, migrated API flows."""
import json
from datetime import datetime

import pytest
from sqlalchemy import select
from test_family_tree_api import tree, create, person_id, BASE
from test_family_tree_ft3 import ft3, login, merge


def export(c):
    job = c.post(BASE + '/exports', json={'format': 'json'})
    assert job.status_code == 200, job.text
    response = c.get(BASE + f'/exports/{job.json()["id"]}/download')
    assert response.status_code == 200, response.text
    return response.json()


def append(c, manifest, revision, key):
    stage = c.post(BASE + '/imports', data={'expected_graph_revision': str(revision)},
                   files={'file': ('tree.json', json.dumps(manifest).encode(), 'application/json')})
    assert stage.status_code == 200, stage.text
    result = c.post(BASE + f'/imports/{stage.json()["id"]}/commit', json={
        'expected_graph_revision': revision, 'idempotency_key': key, 'confirmed': True})
    assert result.status_code == 200, result.text
    return result.json()['affected']['person_ids']


def aliases(manifest, pid):
    return next(p['person']['aliases'] for p in manifest['people'] if p['key'] == f'p:{pid}')


@pytest.mark.parametrize('tree', [True], indirect=True)
def test_individual_alias_export_import_patch_merge_reexport(ft3):
    from app.models.family_tree import FamilyTreeOtherName as Name
    c, factory, ids = ft3
    first = {'name': 'Same alias', 'label': 'First citation'}
    second = {'name': 'Same alias', 'label': 'Second citation'}
    pid = person_id(create(c, aliases=[first]))
    login(c, 'parent@example.test')
    response = c.patch(BASE + f'/people/{pid}', json={
        'expected_graph_revision': 1, 'changes': {'aliases': [first, second]}})
    assert response.status_code == 200, response.text
    # Distinct historical timestamps independent of test-clock granularity.
    with factory() as s:
        rows = list(s.scalars(select(Name).where(Name.person_id == pid).order_by(Name.position)))
        rows[0].created_at = datetime(2001, 2, 3, 4, 5, 6)
        rows[1].created_at = datetime(2002, 3, 4, 5, 6, 7)
        s.commit()
    before = c.get(BASE + f'/people/{pid}').json()['person']['aliases']
    assert [a['created_by_user_id'] for a in before] == [ids['owner'], ids['parent']]
    manifest = export(c)
    original = aliases(manifest, pid)
    assert all(isinstance(a.get('provenance'), dict) for a in original), 'S2: individual alias provenance lost at export'
    assert len({a['provenance']['attribution'] for a in original}) == 2
    assert [a['provenance']['created_at'] for a in original] == [a['created_at'] for a in before]
    assert all(a['provenance']['status'] == 'known' for a in original)
    forbidden = {'created_by_user_id', 'user_id', 'household_id', 'collection_id', 'child_id', 'id'}
    assert not any(forbidden.intersection(a) or forbidden.intersection(a['provenance']) for a in original)
    # Actual importer is a different account and tenant; portable attribution
    # never associates records with the original household accounts.
    login(c, 'other@example.test')
    imported = append(c, manifest, 0, 'alias-import')[0]
    detail = c.get(BASE + f'/people/{imported}').json()
    assert detail['identity_link'] is None
    assert {a['created_by_user_id'] for a in detail['person']['aliases']} == {ids['outsider']}
    assert [a['created_at'] for a in detail['person']['aliases']] != [a['created_at'] for a in before]
    assert aliases(export(c), imported) == original
    changed = c.patch(BASE + f'/people/{imported}', json={
        'expected_graph_revision': 1, 'changes': {'notes_md': 'Retain entered aliases', 'aliases': [second, first]}})
    assert changed.status_code == 200, changed.text
    assert aliases(export(c), imported) == list(reversed(original))
    target = person_id(create(c, rev=2, name='Target', key='alias-target', aliases=[first]))
    assert merge(c, imported, target, 3, 'alias-merge').status_code == 200
    merged = aliases(export(c), target)
    assert merged[1:] == list(reversed(original))
    assert len(merged) == 3  # Duplicate names/labels with separate provenance retained.
    preview = c.post(BASE + f'/people/{imported}/purge-preview', json={
        'expected_graph_revision': 4, 'password': 'password123'})
    assert preview.status_code == 200, preview.text
    purged = c.post(BASE + f'/people/{imported}/purge', json={
        'expected_graph_revision': 4, 'password': 'password123',
        'preview_token': preview.json()['preview_token'], 'idempotency_key': 'alias-purge'})
    assert purged.status_code == 200, purged.text
    final_manifest = export(c)
    assert aliases(final_manifest, target)[1:] == list(reversed(original))
    # Same-tenant authorization continues to guard individual rows.
    login(c, 'parent@example.test')
    assert c.get(BASE + f'/people/{target}').status_code == 404
    third_hop = append(c, final_manifest, 2, 'alias-third-hop')[0]
    assert aliases(export(c), third_hop)[1:] == list(reversed(original))
    assert {a['created_by_user_id'] for a in c.get(BASE + f'/people/{third_hop}').json()['person']['aliases']} == {ids['parent']}


@pytest.mark.parametrize('tree', [True], indirect=True)
def test_legacy_duplicate_aliases_are_explicit_unknown_and_retained(ft3):
    c, _, _ = ft3
    pid = person_id(create(c, aliases=[{'name': 'Duplicate'}, {'name': 'Duplicate'}]))
    manifest = export(c)
    for alias in aliases(manifest, pid):
        alias.pop('provenance', None)
    login(c, 'other@example.test')
    imported = append(c, manifest, 0, 'legacy-alias-import')[0]
    result = aliases(export(c), imported)
    assert len(result) == 2
    assert all(a['provenance'] == {'status': 'unknown', 'source_label': None, 'created_at': None, 'attribution': None} for a in result)


@pytest.mark.parametrize('tree', [True], indirect=True)
def test_portable_alias_text_provenance_survives_and_rejects_authority(ft3):
    c, _, _ = ft3
    pid = person_id(create(c, aliases=[{'name': 'Alias'}]))
    manifest = export(c)
    provenance = {'status': 'known', 'source_label': ' Paper register ', 'created_at': '1901-02-03T04:05:06Z', 'attribution': ' Original recorder '}
    aliases(manifest, pid)[0]['provenance'] = provenance
    login(c, 'other@example.test')
    imported = append(c, manifest, 0, 'text-alias-import')[0]
    assert aliases(export(c), imported)[0]['provenance'] == provenance
    for field in ['created_by_user_id', 'household_id', 'user_id', 'child_id', 'id', 'unexpected']:
        malformed = json.loads(json.dumps(manifest))
        aliases(malformed, pid)[0]['provenance'][field] = 1
        response = c.post(BASE + '/imports', data={'expected_graph_revision': '1'},
                          files={'file': ('bad.json', json.dumps(malformed).encode(), 'application/json')})
        assert response.status_code == 422, response.text
    for alias in [{'name': 'Forged', 'provenance': provenance}, {'name': 'Forged', 'created_by_user_id': 1}]:
        assert create(c, rev=1, name='Forgery', key='forged', aliases=[alias]).status_code == 422
        assert c.patch(BASE + f'/people/{imported}', json={
            'expected_graph_revision': 1, 'changes': {'aliases': [alias]}}).status_code == 422
    assert c.get(BASE + '/').json()['graph_revision'] == 1
