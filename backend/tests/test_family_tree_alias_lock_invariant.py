"""Merged aliases cannot carry an unremovable edit lock."""
import json
from sqlalchemy import select, func
from test_family_tree_api import tree, create, person_id, BASE
from test_family_tree_ft3 import ft3
from app.models.family_tree import FamilyTreePerson, FamilyTreeMediaAsset, FamilyTreeImportSourceKey
from app.services.family_tree import storage


def manifest(alias_locked, canonical_locked=False):
    return {
        'schema_version': 1, 'producer': 'Disposable lifecycle fixture',
        'exported_at': '2026-10-13', 'collection_title': 'Fixture',
        'snapshot_revision': 1,
        'people': [
            {'key': 'canonical', 'person': {'display_name': 'Canonical fixture'},
             'is_locked': canonical_locked, 'lock_reason': 'Reviewed protection' if canonical_locked else None},
            {'key': 'alias', 'person': {'display_name': 'Alias fixture'},
             'archived': True, 'is_locked': alias_locked,
             'lock_reason': 'Imported protection' if alias_locked else None,
             'merged_into_key': 'canonical'},
        ],
    }


def stage(client, package):
    return client.post(BASE + '/imports', data={'expected_graph_revision': '1'},
                       files={'file': ('fixture.json', json.dumps(package).encode(), 'application/json')})


def test_locked_alias_fails_staging_without_domain_or_media_changes(ft3):
    client, factory, _ = ft3
    original = person_id(create(client))
    staged = stage(client, manifest(True))
    assert staged.status_code == 422
    assert staged.json()['detail']['code'] == 'validation_error'
    assert client.get(BASE + '/').json()['graph_revision'] == 1
    assert client.get(BASE + f'/people/{original}').status_code == 200
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(FamilyTreePerson)) == 1
        assert session.scalar(select(func.count()).select_from(FamilyTreeMediaAsset)) == 0
        assert session.scalar(select(func.count()).select_from(FamilyTreeImportSourceKey)) == 0
    for area in ['objects', 'staging', 'artifacts']:
        assert not list((storage.root() / area).iterdir())


def test_locked_canonical_and_unlocked_alias_roundtrip_and_isolated_purge(ft3):
    client, factory, _ = ft3
    person_id(create(client))
    staged = stage(client, manifest(False, True))
    assert staged.status_code == 200
    committed = client.post(BASE + f'/imports/{staged.json()["id"]}/commit', json={
        'expected_graph_revision': 1, 'confirmed': True,
        'idempotency_key': 'valid-alias-lifecycle',
    })
    assert committed.status_code == 200
    with factory() as session:
        alias = session.scalar(select(FamilyTreeImportSourceKey).where(FamilyTreeImportSourceKey.source_key == 'alias')).person_id
        canonical = session.scalar(select(FamilyTreeImportSourceKey).where(FamilyTreeImportSourceKey.source_key == 'canonical')).person_id
        assert session.get(FamilyTreePerson, canonical).is_locked is True
        assert session.get(FamilyTreePerson, alias).is_locked is False
    exported = client.post(BASE + '/exports', json={'format': 'json'})
    package = client.get(BASE + f'/exports/{exported.json()["id"]}/download').json()
    aliases = [person for person in package['people'] if person['merged_into_key'] is not None]
    assert len(aliases) == 1 and aliases[0]['is_locked'] is False
    assert any(person['is_locked'] for person in package['people'] if person['merged_into_key'] is None)
    preview = client.post(BASE + f'/people/{alias}/purge-preview', json={
        'expected_graph_revision': 2, 'password': 'password123',
    })
    assert preview.status_code == 200
    purged = client.post(BASE + f'/people/{alias}/purge', json={
        'expected_graph_revision': 2, 'password': 'password123',
        'preview_token': preview.json()['preview_token'],
        'idempotency_key': 'isolated-alias-purge',
    })
    assert purged.status_code == 200
    with factory() as session:
        assert session.get(FamilyTreePerson, alias) is None
        assert session.get(FamilyTreePerson, canonical).is_locked is True
    assert client.get(BASE + f'/people/{canonical}').status_code == 200
