"""Bounded disposable rollout evidence; never opens an application database."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import json

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT/'backend/scripts/family_tree_rollout_probe.py'


def load():
    spec = importlib.util.spec_from_file_location('rollout_probe', SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_dense_fixture_matches_declared_counts_and_byte_budget():
    m = load()
    fixture = m.fixture('reduced')
    raw = m.encode(fixture)
    assert 2*m.MIB - 500 <= len(raw) <= 2*m.MIB
    assert [len(fixture[k]) for k in ('people','care_links','stories','media','media_references')] == [500,2000,4000,100,4000]
    from app.services.family_tree import portable
    assert portable.validate(portable.decode(raw)) == []


def test_parent_and_child_guards_are_finite():
    m = load()
    assert m.ADDRESS_SPACE_BYTES <= 1536*m.MIB
    assert m.TOTAL_RSS_BYTES <= 1280*m.MIB
    assert m.WALL_SECONDS <= 180
    assert m.child_environment({'DATABASE_URL':'private','FAMILY_TREE_STORAGE_ROOT':'private','PATH':'ok'}) == {'PATH':'ok','APP_ENV':'test','PYTHONPATH':str(ROOT/'backend')}


def test_invalid_arguments_do_not_echo_sensitive_input():
    result = subprocess.run([sys.executable,str(SCRIPT),'--profile','private-sensitive-value'],capture_output=True,text=True)
    assert result.returncode == 2
    assert 'private-sensitive-value' not in result.stdout + result.stderr
    assert json.loads(result.stderr)['code'] == 'invalid_arguments'


def test_templates_have_private_finite_services():
    units = list((ROOT/'ops/family-tree').glob('*.service'))
    assert len(units) == 3
    for unit in units:
        text = unit.read_text()
        assert 'UMask=0077' in text
        assert 'MemoryMax=' in text
        assert 'TimeoutStartSec=' in text
        assert 'User=www-data' in text
        assert 'StandardError=journal' in text
        assert 'NoNewPrivileges=true' in text


def test_health_reports_missing_backup_without_paths(tmp_path):
    script = ROOT/'ops/family-tree/maintenance.py'
    result = subprocess.run([sys.executable,str(script),'health','--state',str(tmp_path)],capture_output=True,text=True)
    assert result.returncode == 1
    assert str(tmp_path) not in result.stdout + result.stderr
    assert json.loads(result.stdout)['code'] == 'backup_missing_or_stale'
