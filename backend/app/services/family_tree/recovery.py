"""Operator-only SQLite online DB+media backups and disposable rehearsal.

No application route installs a DB. The caller supplies explicit operator paths;
backup destinations must be new private directories. Rehearsal destinations
must be new directories under the configured Hermes scratch/explicit scratch
root. Retention pins protect immutable media until backup retention expiry;
backup packages retain their own private bytes independently.
"""
from datetime import UTC, datetime, timedelta
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import sqlite3
import time
from sqlalchemy import select
from app.models.family_tree import FamilyTreeMediaAsset as Asset
from . import storage, media
from .observability import operation_events


def file_hash(path):
    h=hashlib.sha256()
    with open(path,'rb') as stream:
        while data:=stream.read(1024*1024): h.update(data)
    return h.hexdigest()


def copy_immutable(source,target):
    shutil.copyfile(source,target)
    os.chmod(target,0o600)
    fd=os.open(target,os.O_RDONLY|os.O_NOFOLLOW)
    try: os.fsync(fd)
    finally: os.close(fd)


def sync_directory(path):
    fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY)
    try: os.fsync(fd)
    finally: os.close(fd)


def new_directory(path):
    path=Path(path)
    if not path.is_absolute() or any(p.is_symlink() for p in [path,*path.parents]): raise ValueError('Explicit non-symlink absolute operator directory required')
    path.mkdir(mode=0o700,parents=False,exist_ok=False)
    return path


def verify_database(connection):
    if connection.execute('PRAGMA integrity_check').fetchall()!=[('ok',)]: raise ValueError('Database integrity check failed')
    if connection.execute('PRAGMA foreign_key_check').fetchall(): raise ValueError('Database foreign key check failed')


def online_copy(source,destination):
    # SQLite's online backup API includes committed WAL pages; no raw live-file
    # copy, checkpoint assumption or data replacement is involved.
    with sqlite3.connect(destination,timeout=5) as target:
        deadline=time.monotonic()+120
        def progress(status,remaining,total):
            if time.monotonic()>deadline: raise TimeoutError('Online backup exceeded its processing budget')
        source.backup(target,pages=256,sleep=0.01,progress=progress)
        target.execute('PRAGMA journal_mode=DELETE')
        verify_database(target)
    os.chmod(destination,0o600)


@operation_events('backup')
def backup(database_path,destination,factory,retention_days=30):
    database_path=Path(database_path)
    if not database_path.is_absolute() or not database_path.is_file() or database_path.is_symlink(): raise ValueError('Explicit existing SQLite database required')
    if not 1<=retention_days<=366: raise ValueError('Retention must be 1..366 days')
    destination=new_directory(destination)
    token=secrets.token_hex(32)
    try:
        with storage.lock(exclusive=True):
            with sqlite3.connect(database_path.as_uri()+'?mode=ro',uri=True,timeout=5) as source:
                online_copy(source,destination/'database.sqlite')
            with sqlite3.connect((destination/'database.sqlite').as_uri()+'?mode=ro',uri=True) as snapshot:
                snapshot.row_factory=sqlite3.Row
                assets=[dict(r) for r in snapshot.execute("SELECT id,household_id,collection_id,object_key,checksum,byte_size FROM family_tree_media_assets WHERE state='ready' ORDER BY id")]
                revisions=[dict(r) for r in snapshot.execute('SELECT id,household_id,revision FROM family_tree_collections ORDER BY id')]
                jobs=[dict(r) for r in snapshot.execute('SELECT artifact_key,artifact_checksum,payload FROM family_tree_transfer_jobs')]
            with factory() as session:
                for asset in assets:
                    current=session.scalar(select(Asset).where(Asset.id==asset['id'],Asset.household_id==asset['household_id'],Asset.object_key==asset['object_key']))
                    if current is None or current.state!='ready': raise ValueError('Backup media inventory changed before retention pinning')
                    media.pin(session,current,token,'backup',datetime.now(UTC)+timedelta(days=retention_days))
                session.commit()
            (destination/'objects').mkdir(mode=0o700); (destination/'artifacts').mkdir(mode=0o700)
            objects=[]; artifacts=[]; artifact_keys={}
            for job in jobs:
                payload=json.loads(job['payload'])
                if job['artifact_key']: artifact_keys[job['artifact_key']]=job['artifact_checksum']
                for staged in payload.get('media',{}).values(): artifact_keys[staged['key']]=staged['checksum']
                for key in payload.get('cleanup_artifact_keys',[]): artifact_keys.setdefault(key,None)
            for asset in assets:
                source=storage.path(asset['object_key'])
                if file_hash(source)!=asset['checksum'] or source.stat().st_size!=asset['byte_size']: raise ValueError('Backup media integrity failed')
                target=destination/'objects'/asset['object_key']
                copy_immutable(source,target)
                objects.append({'key':asset['object_key'],'checksum':asset['checksum'],'byte_size':asset['byte_size']})
            for key,checksum in artifact_keys.items():
                source=storage.path(key,'artifacts')
                if not source.exists(): raise ValueError('Backup staging artifact is missing')
                actual=file_hash(source)
                if checksum and checksum!=actual: raise ValueError('Backup staging integrity failed')
                target=destination/'artifacts'/key
                copy_immutable(source,target)
                artifacts.append({'key':key,'checksum':actual,'byte_size':target.stat().st_size})
            manifest={'backup_version':1,'snapshot_id':token,'created_at':datetime.now(UTC).isoformat(),'retention_days':retention_days,
                'database_checksum':file_hash(destination/'database.sqlite'),'collection_revisions':revisions,'objects':objects,'artifacts':artifacts}
            fd=os.open(destination/'manifest.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            with os.fdopen(fd,'w') as stream:
                json.dump(manifest,stream,sort_keys=True); stream.flush(); os.fsync(stream.fileno())
            sync_directory(destination/'objects'); sync_directory(destination/'artifacts'); sync_directory(destination)
            verify_package(destination)
            return manifest
    except BaseException:
        # Failed backup is never advertised as a usable recovery point. Retain
        # conservative pins until TTL if process failure made release uncertain.
        shutil.rmtree(destination)
        raise


def verify_package(directory):
    directory=Path(directory)
    manifest=json.loads((directory/'manifest.json').read_text())
    if manifest.get('backup_version')!=1: raise ValueError('Unknown operator backup version')
    if file_hash(directory/'database.sqlite')!=manifest['database_checksum']: raise ValueError('Backup database checksum mismatch')
    for area in ['objects','artifacts']:
        for item in manifest[area]:
            if not __import__('re').fullmatch('[a-f0-9]{64}',item['key']): raise ValueError('Unsafe backup object key')
            path=directory/area/item['key']
            if path.is_symlink() or file_hash(path)!=item['checksum'] or path.stat().st_size!=item['byte_size']: raise ValueError('Backup object checksum mismatch')
    with sqlite3.connect((directory/'database.sqlite').as_uri()+'?mode=ro&immutable=1',uri=True) as connection:
        verify_database(connection)
        inventory={row[0] for row in connection.execute("SELECT object_key FROM family_tree_media_assets WHERE state='ready'")}
        if inventory!={item['key'] for item in manifest['objects']}: raise ValueError('Backup DB/media inventory mismatch')
    return manifest


@operation_events('rehearse')
def rehearse(directory,destination,scratch_root=None):
    directory=Path(directory).resolve()
    scratch=Path(scratch_root or os.getenv('TMPDIR','/root/.hermes/cache/scratch')).resolve()
    destination=Path(destination)
    if not destination.is_absolute() or scratch not in destination.resolve().parents:
        raise ValueError('Restore rehearsal must target a fresh disposable scratch directory')
    manifest=verify_package(directory)
    destination=new_directory(destination)
    try:
        with sqlite3.connect((directory/'database.sqlite').as_uri()+'?mode=ro&immutable=1',uri=True) as source:
            online_copy(source,destination/'database.sqlite')
        for area in ['objects','artifacts']:
            (destination/area).mkdir(mode=0o700)
            for item in manifest[area]:
                target=destination/area/item['key']
                copy_immutable(directory/area/item['key'],target)
                if file_hash(target)!=item['checksum']: raise ValueError('Restored object mismatch')
        with sqlite3.connect(destination/'database.sqlite') as restored:
            verify_database(restored)
            counts={table:restored.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] for table in ['households','users','children','family_tree_people','family_tree_media_references']}
        return {'integrity_check':'ok','foreign_key_check':'ok','objects_verified':len(manifest['objects']),'artifacts_verified':len(manifest['artifacts']),'counts':counts,'snapshot_id':manifest['snapshot_id']}
    except BaseException:
        shutil.rmtree(destination); raise
