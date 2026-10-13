"""Purge credential storage and recovery acceptance on both schema paths."""
import hashlib
import json
import os
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path
import pytest
from sqlalchemy import select
from test_family_tree_ft3 import tree, ft3, upload, merge, create, person_id, BASE
from app.models import User
from app.models.family_tree import FamilyTreeMutationReceipt as Receipt, FamilyTreeMediaAsset as Asset, FamilyTreeMediaPin as Pin, FamilyTreeMediaReference as Reference
from app.schemas.family_tree_transfer import PurgeCommit
from app.services.family_tree import media, recovery, cleanup, storage
from app.security import hash_password

pytestmark=pytest.mark.parametrize('tree',[False,True],indirect=True)


def purge_person(c,pid,rev,key):
    preview=c.post(BASE+f'/people/{pid}/purge-preview',json={'expected_graph_revision':rev,'password':'password123'})
    assert preview.status_code==200
    body={'expected_graph_revision':rev,'password':'password123','preview_token':preview.json()['preview_token'],'idempotency_key':key}
    result=c.post(BASE+f'/people/{pid}/purge',json=body)
    assert result.status_code==200
    return body


def test_missing_purge_key_rejects_without_mutation(ft3):
    c,factory,_=ft3
    p=person_id(create(c))
    preview=c.post(BASE+f'/people/{p}/purge-preview',json={'expected_graph_revision':1,'password':'password123'})
    assert preview.status_code==200
    r=c.post(BASE+f'/people/{p}/purge',json={'expected_graph_revision':1,'password':'password123','preview_token':preview.json()['preview_token']})
    assert r.status_code==422
    assert c.get(BASE+'/').json()['graph_revision']==1
    with factory() as s:
        from app.models.family_tree import FamilyTreePerson
        assert s.get(FamilyTreePerson,p) is not None
        assert s.scalar(select(Receipt).where(Receipt.operation==f'purge:{p}')) is None


def test_purge_receipt_not_an_offline_password_verifier_and_replay_reauthorizes(ft3):
    c,factory,ids=ft3
    p=person_id(create(c))
    body=purge_person(c,p,1,'credential-proof')
    with factory() as s:
        receipt=s.scalar(select(Receipt).where(Receipt.operation==f'purge:{p}'))
        persisted=receipt.body_digest
    # Fixed-message assertions prevent pytest from printing credential operands.
    candidates=[body['password'],'wrong-synthetic-password']
    guessed=[]
    for candidate in candidates:
        canonical=PurgeCommit.model_validate({**body,'password':candidate}).model_dump(mode='json')
        guessed.append(hashlib.sha256(json.dumps(canonical,sort_keys=True,separators=(',',':')).encode()).hexdigest()==persisted)
    assert not any(guessed), 'Receipt must not verify password guesses'
    canonical=PurgeCommit.model_validate(body).model_dump(mode='json',exclude={'password'})
    digest=hashlib.sha256(json.dumps(canonical,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    assert bool(digest==persisted), 'Receipt identity excludes authorization secrets'
    assert c.post(BASE+f'/people/{p}/purge',json={**body,'password':candidates[1]}).status_code==403
    assert c.post(BASE+f'/people/{p}/purge',json=body).json()['replayed'] is True
    changed={**body,'expected_graph_revision':2}
    r=c.post(BASE+f'/people/{p}/purge',json=changed)
    assert r.status_code==409 and r.json()['detail']['code']=='idempotency_conflict'
    # Password rotation changes authorization, not mutation identity.
    fresh='new-synthetic-valid-password'
    with factory() as s:
        s.get(User,ids['owner']).password_hash=hash_password(fresh);s.commit()
    assert c.post(BASE+f'/people/{p}/purge',json=body).status_code==403
    replay=c.post(BASE+f'/people/{p}/purge',json={**body,'password':fresh})
    assert replay.status_code==200 and replay.json()['replayed'] is True
    assert c.get(BASE+'/').json()['graph_revision']==2


def test_alias_purge_shared_media_and_backup_restore_acceptance(ft3,tmp_path):
    c,factory,ids=ft3
    a=person_id(create(c,name='Alias'));b=person_id(create(c,1,'Canonical','b'));other=person_id(create(c,2,'Other','other'))
    asset=upload(c).json()['id']
    for p,rev in [(a,3),(other,4)]:
        assert c.post(BASE+f'/media/{asset}/attach',json={'expected_graph_revision':rev,'person_id':p,'role':'primary'}).status_code==200
    assert merge(c,a,b,5).status_code==200
    with factory() as s:
        row=s.get(Asset,asset);row.created_at=datetime.now(UTC)-timedelta(days=2); key=row.object_key
        s.query(Pin).filter(Pin.purpose=='upload').delete();s.commit()
    database=Path(factory.kw['bind'].url.database)
    backup=tmp_path/'backup'
    manifest=recovery.backup(database,backup,factory,retention_days=30)
    assert len(manifest['objects'])==1
    purge_person(c,a,6,'alias-purge')
    assert c.get(BASE+f'/people/{b}').json()['person']['primary_image_asset_id']==asset
    assert c.get(BASE+f'/people/{other}').json()['person']['primary_image_asset_id']==asset
    purge_person(c,b,7,'canonical-purge')
    assert c.get(BASE+f'/people/{other}').json()['person']['primary_image_asset_id']==asset
    purge_person(c,other,8,'remaining-purge')
    with factory() as s:
        assert s.scalar(select(Reference.id)) is None
        assert s.scalar(select(Pin).where(Pin.purpose=='backup')) is not None
        assert media.claim_deletion(s,asset) is None
    assert storage.path(key).exists()
    restored=recovery.rehearse(backup,tmp_path/'restore',scratch_root=tmp_path)
    assert restored['integrity_check']==restored['foreign_key_check']=='ok'
    assert restored['objects_verified']==1
    with sqlite3.connect(tmp_path/'restore'/'database.sqlite') as db:
        assert db.execute('SELECT COUNT(*) FROM family_tree_people').fetchone()[0]==3
        assert db.execute('SELECT COUNT(*) FROM family_tree_media_references').fetchone()[0]==2
        assert db.execute('SELECT owner_user_id FROM households WHERE id=?',(ids['household'],)).fetchone()[0]==ids['owner']
    with factory() as s:
        for pin in s.scalars(select(Pin)): pin.expires_at=datetime.now(UTC)-timedelta(days=1)
        s.commit()
    result=cleanup.cleanup(factory)
    assert result['deleted_assets']==1
    assert not storage.path(key).exists()
    assert recovery.verify_package(backup)['snapshot_id']==manifest['snapshot_id']
    assert c.get(BASE+'/people').json()['total']==0
