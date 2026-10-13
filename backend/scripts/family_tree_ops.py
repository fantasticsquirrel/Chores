"""Explicit operator FT cleanup/online backup/disposable restore tool.

No command replaces an application database. Operations require private explicit
paths and FAMILY_TREE_STORAGE_ROOT. Scheduling/retention remain operator-owned.
stdout is success aggregate JSON; stderr contains safe classified event JSON.
"""
import argparse
import json
import logging
from pathlib import Path
import sys
from app.services.family_tree import cleanup, recovery
from app.services.family_tree.observability import logger, emit, classify
from app.db import get_session_factory


class InvalidArguments(ValueError):
    pass


class SafeParser(argparse.ArgumentParser):
    def error(self, message):
        # argparse interpolates invalid user arguments; never print them.
        raise InvalidArguments()


def main(argv=None):
    handler=logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter('%(message)s'))
    old_handlers,old_level,old_propagate=logger.handlers[:],logger.level,logger.propagate
    logger.handlers=[handler]; logger.setLevel(logging.INFO); logger.propagate=False
    operation=None
    try:
        parser=SafeParser(description=__doc__)
        parser.add_argument('--database',type=Path)
        commands=parser.add_subparsers(dest='operation',required=True)
        clean=commands.add_parser('cleanup'); clean.add_argument('--batch-size',type=int,default=100)
        backup=commands.add_parser('backup'); backup.add_argument('--destination',type=Path,required=True); backup.add_argument('--retention-days',type=int,default=30)
        restore=commands.add_parser('rehearse'); restore.add_argument('--backup',type=Path,required=True); restore.add_argument('--destination',type=Path,required=True); restore.add_argument('--scratch-root',type=Path,required=True)
        args=parser.parse_args(argv)
        operation=args.operation
        if operation=='rehearse':
            result=recovery.rehearse(args.backup,args.destination,args.scratch_root)
        else:
            if args.database is None or not args.database.is_absolute() or not args.database.is_file():
                raise InvalidArguments()
            factory=get_session_factory('sqlite:///'+str(args.database))
            if operation=='cleanup': result=cleanup.cleanup(factory,args.batch_size)
            else:
                manifest=recovery.backup(args.database,args.destination,factory,args.retention_days)
                result={'snapshot_id':manifest['snapshot_id'],'objects':len(manifest['objects']),'artifacts':len(manifest['artifacts']),'integrity_check':'ok'}
        emit('operator_completed', operation=operation)
        print(json.dumps(result,sort_keys=True))
        return 0
    except (Exception,KeyboardInterrupt) as exc:
        fields={'code':'invalid_arguments'} if isinstance(exc,InvalidArguments) else classify(exc)
        emit('operator_failed', operation=operation, **fields)
        return 2 if isinstance(exc,InvalidArguments) else 130 if isinstance(exc,KeyboardInterrupt) else 1
    finally:
        logger.handlers=old_handlers; logger.setLevel(old_level); logger.propagate=old_propagate
        handler.close()


if __name__=='__main__': sys.exit(main())
