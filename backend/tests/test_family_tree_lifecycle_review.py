"""Actual process death and store/SQL ordering for import/export/backup cleanup."""
import contextlib
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
import os
from pathlib import Path
import subprocess
from threading import Event
import pytest
from sqlalchemy import select, delete
from test_family_tree_ft3 import tree, ft3, upload, create, person_id, BASE
from app.models.family_tree import FamilyTreeMediaAsset as Asset, FamilyTreeMediaPin as Pin, FamilyTreeMediaReference as Ref
from app.services.family_tree import cleanup, storage, recovery

pytestmark=pytest.mark.parametrize('tree',[False,True],indirect=True)


def age_and_release_upload(factory,asset):
    with factory() as s:
        row=s.get(Asset,asset);row.created_at=datetime.now(UTC)-timedelta(days=2)
        s.execute(delete(Pin).where(Pin.asset_id==asset,Pin.purpose=='upload'));s.commit()
        return row.object_key


def test_actual_process_death_recovers_claim_and_unpublished_object(ft3):
    c,factory,_=ft3
    person_id(create(c));asset=upload(c).json()['id'];key=age_and_release_upload(factory,asset)
    env=dict(os.environ,APP_ENV='test',DATABASE_URL=str(factory.kw['bind'].url),PYTHONPATH=str(Path(__file__).resolve().parents[1]))
    runner=os.getenv('FAMILY_TREE_TEST_PYTHON','/var/ralph-projects/chore_tracking/.venv/bin/python')
    source="from app.config import get_settings;from app.db import get_session_factory;from app.services.family_tree import media;import os;factory=get_session_factory(get_settings().database_url);s=factory();assert media.claim_deletion(s,"+str(asset)+") is not None;os._exit(73)"
    result=subprocess.run([runner,'-c',source],env=env,capture_output=True,timeout=30)
    assert result.returncode==73
    with factory() as s:
        row=s.get(Asset,asset);assert row.state=='deleting'
        row.claim_expires_at=datetime.now(UTC)-timedelta(minutes=1);s.commit()
    assert storage.path(key).exists()
    before={p.name for p in (storage.root()/'objects').iterdir()}
    source="from app.services.family_tree import storage;import os;\nwith storage.lock():\n storage.write(b'crash-orphan');os._exit(74)"
    result=subprocess.run([runner,'-c',source],env=env,capture_output=True,timeout=30)
    assert result.returncode==74
    orphan=({p.name for p in (storage.root()/'objects').iterdir()}-before).pop()
    old=(datetime.now(UTC)-timedelta(days=2)).timestamp();os.utime(storage.path(orphan),(old,old))
    result=cleanup.cleanup(factory)
    assert result['deleted_assets']==1 and result['orphan_files']==1
    assert not storage.path(key).exists() and not storage.path(orphan).exists()
    with factory() as s:assert s.get(Asset,asset).state=='deleted'


@pytest.mark.parametrize('writer',['import','export','backup'])
def test_live_operations_coordinate_cleanup_with_real_retention(ft3,tmp_path,monkeypatch,writer):
    c,factory,_=ft3
    p=person_id(create(c));asset=upload(c).json()['id']
    if writer!='backup':
        attached=c.post(BASE+f'/media/{asset}/attach',json={'expected_graph_revision':1,'person_id':p,'role':'primary'});assert attached.status_code==200
        ref=attached.json()['affected']['media_reference_ids'][0]
    key=age_and_release_upload(factory,asset)
    if writer=='import':
        exp=c.post(BASE+'/exports',json={'format':'zip'}).json()['id'];data=c.get(BASE+f'/exports/{exp}/download').content
        job=c.post(BASE+'/imports',data={'expected_graph_revision':'2'},files={'file':('tree.zip',data,'application/zip')}).json()['id']
    holding=Event();release=Event();cleaner_waiting=Event();finished=Event()
    original_lock=storage.lock
    @contextlib.contextmanager
    def tracked_lock(exclusive=False):
        if exclusive and holding.is_set():cleaner_waiting.set()
        with original_lock(exclusive):yield
    monkeypatch.setattr(storage,'lock',tracked_lock)
    original_write=storage.write;original_copy=recovery.copy_immutable
    def write(data,area='objects'):
        result=original_write(data,area)
        if area==('objects' if writer=='import' else 'artifacts') and writer!='backup':
            holding.set();assert release.wait(10)
        return result
    def copy(source,target):
        holding.set();assert release.wait(10)
        return original_copy(source,target)
    if writer=='backup':monkeypatch.setattr(recovery,'copy_immutable',copy)
    else:monkeypatch.setattr(storage,'write',write)
    def produce():
        if writer=='backup':return recovery.backup(Path(factory.kw['bind'].url.database),tmp_path/'backup',factory)
        if writer=='export':return c.post(BASE+'/exports',json={'format':'json'})
        return c.post(BASE+f'/imports/{job}/commit',json={'expected_graph_revision':2,'idempotency_key':'racing-import','confirmed':True})
    def sweep():
        try:return cleanup.cleanup(factory)
        finally:finished.set()
    with ThreadPoolExecutor(max_workers=2) as pool:
        producer=pool.submit(produce);assert holding.wait(10)
        if writer=='export':
            # Remove the live reference; only the actual export pin now retains
            # the old image while the private snapshot artifact is being built.
            assert c.request('DELETE',BASE+f'/media/{asset}/references/{ref}',json={'expected_graph_revision':2}).status_code==200
        cleaner=pool.submit(sweep);assert cleaner_waiting.wait(10)
        assert not finished.is_set()
        release.set();result=producer.result(timeout=20);swept=cleaner.result(timeout=20)
    assert storage.path(key).exists()
    with factory() as s:
        assert s.get(Asset,asset).state=='ready'
        if writer=='import':
            assert result.status_code==200
            new_asset=result.json()['affected']['media_asset_ids'][0]
            row=s.get(Asset,new_asset);assert row.state=='ready' and storage.path(row.object_key).exists()
            assert s.scalar(select(Ref).where(Ref.asset_id==new_asset)) is not None
        elif writer=='export':
            assert result.status_code==200
            assert s.scalar(select(Pin).where(Pin.asset_id==asset,Pin.purpose=='export')) is not None
        else:
            assert s.scalar(select(Pin).where(Pin.asset_id==asset,Pin.purpose=='backup')) is not None
            assert recovery.verify_package(tmp_path/'backup')['snapshot_id']==result['snapshot_id']
