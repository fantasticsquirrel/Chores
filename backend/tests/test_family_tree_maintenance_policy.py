import importlib.util
from pathlib import Path
import pytest

SCRIPT=Path(__file__).resolve().parents[2]/'ops/family-tree/maintenance.py'


def load():
    spec=importlib.util.spec_from_file_location('ft_maintenance',SCRIPT)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def test_health_requires_cleanup_heartbeat(tmp_path,capsys):
    (tmp_path/'backup.success').touch()
    assert load().health(tmp_path)==1
    assert 'cleanup_missing_or_stale' in capsys.readouterr().out


def test_health_checks_real_disk_paths(tmp_path,monkeypatch,capsys):
    module=load()
    for key in ('backup','cleanup'): (tmp_path/(key+'.success')).touch()
    database=tmp_path/'app.sqlite';database.touch()
    monkeypatch.setenv('FAMILY_TREE_OPS_DATABASE',str(database))
    monkeypatch.setenv('FAMILY_TREE_STORAGE_ROOT',str(tmp_path))
    monkeypatch.setenv('FAMILY_TREE_OPS_BACKUP_ROOT',str(tmp_path))
    calls=[]
    from collections import namedtuple
    Usage=namedtuple('Usage','total used free')
    def usage(path):
        calls.append(path);return Usage(10*1024**3,10*1024**3-1,1)
    monkeypatch.setattr(module.shutil,'disk_usage',usage)
    assert module.health(tmp_path)==1
    assert 'disk_capacity_low' in capsys.readouterr().out
    assert calls
