"""Explicit operator FT media cleanup/online backup/disposable restore tool.

Usage (operator paths only; never a runtime upload endpoint):
  PYTHONPATH=backend python backend/scripts/family_tree_ops.py --database /abs/db.sqlite backup --destination /abs/new-private-dir
  PYTHONPATH=backend python backend/scripts/family_tree_ops.py --database /abs/db.sqlite cleanup --batch-size 100
  PYTHONPATH=backend python backend/scripts/family_tree_ops.py rehearse --backup /abs/package --destination /abs/scratch/new-dir --scratch-root /abs/scratch
No command replaces an application database. Store operations require
FAMILY_TREE_STORAGE_ROOT; scheduled invocation/retention policy is operator-owned.
"""
import argparse
import json
from pathlib import Path
from app.services.family_tree import cleanup, recovery
from app.db import get_session_factory


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database',type=Path)
    commands=parser.add_subparsers(dest='operation',required=True)
    clean=commands.add_parser('cleanup'); clean.add_argument('--batch-size',type=int,default=100)
    backup=commands.add_parser('backup'); backup.add_argument('--destination',type=Path,required=True); backup.add_argument('--retention-days',type=int,default=30)
    restore=commands.add_parser('rehearse'); restore.add_argument('--backup',type=Path,required=True); restore.add_argument('--destination',type=Path,required=True); restore.add_argument('--scratch-root',type=Path,required=True)
    args=parser.parse_args()
    if args.operation=='rehearse':
        result=recovery.rehearse(args.backup,args.destination,args.scratch_root)
    else:
        if args.database is None or not args.database.is_absolute() or not args.database.is_file(): parser.error('An explicit existing absolute SQLite --database is required')
        factory=get_session_factory('sqlite:///'+str(args.database))
        if args.operation=='cleanup': result=cleanup.cleanup(factory,args.batch_size)
        else:
            manifest=recovery.backup(args.database,args.destination,factory,args.retention_days)
            result={'snapshot_id':manifest['snapshot_id'],'objects':len(manifest['objects']),'artifacts':len(manifest['artifacts']),'integrity_check':'ok'}
    print(json.dumps(result,sort_keys=True))

if __name__=='__main__': main()
