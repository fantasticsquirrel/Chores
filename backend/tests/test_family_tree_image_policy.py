"""Configured image bounds apply to persisted images and portable recovery."""
import io
import random
from functools import lru_cache
from PIL import Image
from sqlalchemy import select, func
from test_family_tree_ft3 import tree, ft3, create, person_id, upload, BASE
from app.models.family_tree import FamilyTreeMediaAsset as Asset, FamilyTreeMediaPin as Pin, FamilyTreeTransferJob as Job
from app.services.family_tree import storage

CAP = 8 * 1024 * 1024


@lru_cache(maxsize=2)
def noise_png(side):
    image = Image.frombytes('RGB', (side, side), random.Random(35).randbytes(side * side * 3))
    out = io.BytesIO()
    image.save(out, format='PNG')
    image.close()
    return out.getvalue()


def test_sanitized_expansion_rejects_before_media_publication(ft3, monkeypatch):
    client, factory, _ = ft3
    person_id(create(client))
    monkeypatch.setenv('FAMILY_TREE_IMAGE_MAX_BYTES', str(CAP))
    raw = noise_png(1600)
    assert len(raw) < CAP
    # Real PNG conversion establishes that this deterministic fixture crosses
    # the selected cap, not a mocked codec or a hardcoded response.
    with Image.open(io.BytesIO(raw)) as image:
        out = io.BytesIO()
        image.convert('RGBA').save(out, format='PNG')
        assert len(out.getvalue()) > CAP
    response = upload(client, raw)
    assert response.status_code == 413, response.text
    assert response.json()['detail']['code'] == 'resource_limit'
    assert client.get(BASE + '/').json()['graph_revision'] == 1
    with factory() as session:
        for model in (Asset, Pin, Job):
            assert session.scalar(select(func.count()).select_from(model)) == 0
    for area in ('objects', 'artifacts', 'staging'):
        assert not list((storage.root() / area).iterdir())


def test_existing_over_policy_media_blocks_zip_but_preserves_metadata_and_objects(ft3, monkeypatch):
    client, factory, _ = ft3
    person = person_id(create(client))
    result = upload(client, noise_png(1600))
    assert result.status_code == 200, result.text
    asset = result.json()
    assert CAP < asset['byte_size'] <= storage.MAX_IMAGE
    assert client.post(BASE + f'/media/{asset["id"]}/attach', json={
        'expected_graph_revision': 1, 'person_id': person, 'role': 'primary',
    }).status_code == 200
    monkeypatch.setenv('FAMILY_TREE_IMAGE_MAX_BYTES', str(CAP))
    result = client.post(BASE + '/exports', json={'format': 'zip'})
    assert result.status_code == 413, result.text
    assert client.get(BASE + '/').json()['graph_revision'] == 2
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(Job)) == 0
        assert session.get(Asset, asset['id']).state == 'ready'
        assert session.scalar(select(func.count()).select_from(Pin)) == 1
    assert not list((storage.root() / 'artifacts').iterdir())
    content = client.get(BASE + f'/media/{asset["id"]}/content')
    assert content.status_code == 200 and len(content.content) == asset['byte_size']
    metadata = client.post(BASE + '/exports', json={'format': 'json'})
    assert metadata.status_code == 200
    downloaded = client.get(BASE + f'/exports/{metadata.json()["id"]}/download')
    assert downloaded.status_code == 200 and downloaded.json()['media_omitted'] is True


def test_admitted_image_zip_roundtrip_under_identical_policy(ft3, monkeypatch):
    client, _, _ = ft3
    monkeypatch.setenv('FAMILY_TREE_IMAGE_MAX_BYTES', str(CAP))
    person = person_id(create(client))
    result = upload(client, noise_png(1000))
    assert result.status_code == 200 and result.json()['byte_size'] <= CAP
    asset = result.json()
    assert client.post(BASE + f'/media/{asset["id"]}/attach', json={
        'expected_graph_revision': 1, 'person_id': person, 'role': 'primary',
    }).status_code == 200
    exported = client.post(BASE + '/exports', json={'format': 'zip'})
    assert exported.status_code == 200
    downloaded = client.get(BASE + f'/exports/{exported.json()["id"]}/download')
    assert downloaded.status_code == 200
    staged = client.post(BASE + '/imports', data={'expected_graph_revision': '2'},
                         files={'file': ('tree.zip', downloaded.content, 'application/zip')})
    assert staged.status_code == 200, staged.text
    committed = client.post(BASE + f'/imports/{staged.json()["id"]}/commit', json={
        'expected_graph_revision': 2, 'idempotency_key': 'same-policy-roundtrip', 'confirmed': True,
    })
    assert committed.status_code == 200, committed.text
    imported = committed.json()['affected']['person_ids'][0]
    images = client.get(BASE + f'/people/{imported}/media')
    assert images.status_code == 200
    assert client.get(BASE + '/people').json()['total'] == 2
