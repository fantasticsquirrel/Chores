"""Private finite scheduler adapter. No outbound transport; content-free JSON."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import subprocess
import shutil
import sys
import time
from datetime import datetime, UTC


def emit(code,ok):
    print(json.dumps({'event':'family_tree_maintenance','code':code,'ok':ok}),flush=True)


def health(state,now=None):
    now = time.time() if now is None else now
    try:
        success = state/'backup.success'
        if success.is_symlink() or not 0<=now-success.stat().st_mtime<=36*3600:
            raise ValueError()
        if (state/'backup.failed').exists():
            raise ValueError()
    except (OSError,ValueError):
        emit('backup_missing_or_stale',False)
        return 1
    try:
        success=state/'cleanup.success'
        if success.is_symlink() or not 0<=now-success.stat().st_mtime<=36*3600 or (state/'cleanup.failed').exists():
            raise ValueError()
    except (OSError,ValueError):
        emit('cleanup_missing_or_stale',False)
        return 1
    try:
        paths=[Path(os.environ['FAMILY_TREE_OPS_DATABASE']).parent,Path(os.environ['FAMILY_TREE_STORAGE_ROOT']),
               Path(os.environ.get('FAMILY_TREE_OPS_BACKUP_ROOT','/var/backups/chore-tracker/family-tree')),state]
        for path in paths:
            if not path.is_absolute() or not path.is_dir() or any(p.is_symlink() for p in [path,*path.parents]):
                raise ValueError()
            usage=shutil.disk_usage(path)
            if usage.free<max(256*1024*1024,usage.total//10):
                emit('disk_capacity_low',False)
                return 1
    except (OSError,KeyError,ValueError):
        emit('storage_health_unavailable',False)
        return 1
    emit('maintenance_healthy',True)
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation',choices=['backup','cleanup','health'])
    parser.add_argument('--state',type=Path,default=Path('/var/lib/chore-tracker/family-tree-ops'))
    args = parser.parse_args()
    if args.operation == 'health':
        return health(args.state)
    os.umask(0o077)
    # Parent is explicitly provisioned; never fall back to another database.
    state = args.state
    try:
        if not state.is_absolute() or any(p.is_symlink() for p in [state,*state.parents]):
            raise ValueError()
        state.mkdir(mode=0o700,exist_ok=True)
        if state.stat().st_mode & 0o077:
            raise ValueError()
        with os.fdopen(os.open(state/'maintenance.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600),'w') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            root = Path('/var/ralph-projects/chore_tracking')
            database = os.environ['FAMILY_TREE_OPS_DATABASE']
            if not Path(database).is_absolute() or not Path(database).is_file():
                raise ValueError()
            command = [sys.executable,str(root/'backend/scripts/family_tree_ops.py'),'--database',database,args.operation]
            if args.operation == 'backup':
                destination = Path(os.environ.get('FAMILY_TREE_OPS_BACKUP_ROOT','/var/backups/chore-tracker/family-tree'))/datetime.now(UTC).strftime('%Y%m%dT%H%M%S.%fZ')
                command += ['--destination',str(destination),'--retention-days','30']
            else:
                command += ['--batch-size','100']
            # CLI logs are allowlisted; never emit exception strings/argv.
            result = subprocess.run(command,timeout=150,check=False)
            if result.returncode:
                raise RuntimeError()
            temporary = state/(args.operation+'.success.tmp')
            fd = os.open(temporary,os.O_CREAT|os.O_TRUNC|os.O_WRONLY|os.O_NOFOLLOW,0o600)
            os.close(fd)
            temporary.replace(state/(args.operation+'.success'))
            (state/(args.operation+'.failed')).unlink(missing_ok=True)
        emit('completed',True)
        return 0
    except (Exception,KeyboardInterrupt):
        try:
            fd = os.open(state/(args.operation+'.failed'),os.O_CREAT|os.O_WRONLY|os.O_NOFOLLOW,0o600)
            os.close(fd)
        except OSError:
            pass
        emit('maintenance_failed',False)
        return 1


if __name__ == '__main__':
    sys.exit(main())
