"""Bounded explicit worker for TTL jobs, media claims and orphan recovery."""
from datetime import UTC, datetime, timedelta
import os
import re
import json
import heapq
from sqlalchemy import select, delete, exists, text
from app.models.family_tree import FamilyTreeMediaAsset as Asset, FamilyTreeMediaPin as Pin, FamilyTreeTransferJob as Job, FamilyTreeMutationReceipt as Receipt, FamilyTreeMediaReference as Reference
from . import storage, media


def cleanup(factory, batch_size=100, now=None):
    if not 1<=batch_size<=1000: raise ValueError('Invalid cleanup batch size')
    now=now or datetime.now(UTC)
    result={'expired_jobs':0,'deleted_assets':0,'orphan_files':0,'expired_pins':0}
    # Lock order is store -> database in API publishing/cleanup/recovery paths.
    with storage.lock(exclusive=True), factory() as session:
        result['expired_pins']=session.execute(delete(Pin).where(Pin.expires_at<=now)).rowcount
        session.execute(delete(Receipt).where(Receipt.expires_at<=now))
        rows=list(session.scalars(select(Job).where(((Job.state=='ready') & (Job.expires_at<=now)) | (Job.state.in_(['canceled','failed','expired','committed']) & ((Job.artifact_key.is_not(None)) | (Job.payload!={})))).order_by(Job.id).limit(batch_size)))
        expired_keys=[]
        for job in rows:
            keys=[m['key'] for m in job.payload.get('media',{}).values()]+job.payload.get('cleanup_artifact_keys',[])
            if job.artifact_key: keys.append(job.artifact_key)
            expired_keys.extend(keys)
            if job.state=='ready': job.state='expired'; result['expired_jobs']+=1
            job.payload={}; job.artifact_key=None; job.artifact_checksum=None
            session.execute(delete(Pin).where(Pin.token==job.token))
        session.commit()
        for key in expired_keys: storage.unlink(key,'artifacts')
        eligible=((Asset.state=='ready') & (Asset.created_at<now-timedelta(days=1))) | ((Asset.state=='deleting') & (Asset.claim_expires_at<=now))
        unreferenced=~exists(select(Reference.id).where(Reference.asset_id==Asset.id))
        unpinned=~exists(select(Pin.id).where(Pin.asset_id==Asset.id,Pin.expires_at>now))
        ids=list(session.scalars(select(Asset.id).where(eligible,unreferenced,unpinned).order_by(Asset.id).limit(batch_size)))
        for asset_id in ids:
            token=media.claim_deletion(session,asset_id,now=now)
            if token and media.finish_deletion(session,asset_id,token): result['deleted_assets']+=1
        # Reconcile filesystem-only leftovers after interrupted publish or
        # household/account deletion. New/active operations hold shared lock.
        cursor_path=storage.root()/'.cleanup-cursor'
        cursors={}
        if cursor_path.exists():
            fd=os.open(cursor_path,os.O_RDONLY|os.O_NOFOLLOW)
            with os.fdopen(fd,'r') as stream:
                try: cursors=json.loads(stream.read(4096))
                except ValueError: cursors={}
            if not isinstance(cursors,dict): cursors={}
        cutoff=now.timestamp()-86400
        for area in ['objects','artifacts','staging']:
            cursor=cursors.get(area,'')
            if cursor and not re.fullmatch('[a-f0-9]{64}',cursor): cursor=''
            # nsmallest is bounded-memory; cursor advances even past retained
            # files, so attached assets cannot starve later orphan cleanup.
            with os.scandir(storage.root()/area) as directory:
                keys=heapq.nsmallest(batch_size,(entry.name for entry in directory if entry.name>cursor and re.fullmatch('[a-f0-9]{64}',entry.name) and entry.is_file(follow_symlinks=False)))
            if not keys: cursors[area]=''; continue
            for key in keys:
                managed=False
                if area=='objects':
                    managed=bool(session.scalar(select(Asset.id).where(Asset.object_key==key,Asset.state!='deleted').limit(1)))
                elif area=='artifacts':
                    managed=bool(session.scalar(select(Job.id).where(Job.artifact_key==key).limit(1)))
                    if not managed:
                        managed=bool(session.execute(text("SELECT 1 FROM family_tree_transfer_jobs, json_each(json_extract(payload,'$.media')) AS entries WHERE json_extract(entries.value,'$.key')=:key LIMIT 1"),{'key':key}).first())
                    if not managed:
                        managed=bool(session.execute(text("SELECT 1 FROM family_tree_transfer_jobs, json_each(json_extract(payload,'$.cleanup_artifact_keys')) AS entries WHERE entries.value=:key LIMIT 1"),{'key':key}).first())
                if not managed and storage.path(key,area).stat().st_mtime<cutoff:
                    storage.unlink(key,area); result['orphan_files']+=1
            cursors[area]=keys[-1]
        temporary=storage.write(json.dumps(cursors,sort_keys=True).encode(),'artifacts')
        os.replace(storage.path(temporary,'artifacts'),cursor_path)
        directory_fd=os.open(storage.root(),os.O_RDONLY|os.O_DIRECTORY)
        try: os.fsync(directory_fd)
        finally: os.close(directory_fd)
    return result
