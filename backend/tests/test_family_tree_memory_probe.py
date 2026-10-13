"""Probe safety/runbook contracts; intentionally no second heavy benchmark."""
import ast
import importlib.util
import os
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[2]
SCRIPT=ROOT/'backend/scripts/family_tree_memory_probe.py'


def probe_module():
    spec=importlib.util.spec_from_file_location('family_tree_memory_probe',SCRIPT)
    assert spec is not None and spec.loader is not None
    module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def test_probe_fixed_safe_limits_and_real_production_functions():
    module=probe_module()
    assert module.ADDRESS_SPACE_BYTES==768*1024*1024 < 1024*1024*1024
    assert module.PEOPLE==5000 and module.NOTE_BYTES==1024 and module.SIDE==4096
    source=SCRIPT.read_text()
    tree=ast.parse(source)
    calls={ast.unparse(node.func) for node in ast.walk(tree) if isinstance(node,ast.Call)}
    assert {'portable.decode','portable.validate','media.sanitize','resource.setrlimit','subprocess.run'} <= calls
    assert 'resource.RLIMIT_AS' in source and 'resource.RLIMIT_CPU' in source
    assert 'timeout=90' in source and 'capture_output=True' in source
    assert "'REFERENCE_ONLY_OPERATOR_BUDGET_HOLD'" in source
    assert 'ru_maxrss*1024' in source and "'/proc/self/status'" in source
    assert len(source.splitlines())<=500


def test_memory_probe_invalid_argument_never_echoes_private_input():
    private='PRIVATE-person-photo-path-password-bundle'
    result=subprocess.run([sys.executable,str(SCRIPT),private],capture_output=True,text=True,env={**os.environ,'APP_ENV':'test'})
    assert result.returncode==2
    assert private not in result.stdout+result.stderr and 'Traceback' not in result.stderr
    assert 'invalid_arguments' in result.stderr


def test_memory_worker_parent_failure_does_not_publish_measurement(monkeypatch,capsys):
    module=probe_module()
    class Failed:
        returncode=1
        stdout='PRIVATE-JSON-or-credentials'
        stderr='PRIVATE-exception-path'
    monkeypatch.setattr(module.subprocess,'run',lambda *args,**kwargs: Failed())
    assert module.main()==1
    captured=capsys.readouterr()
    assert captured.out=='' and 'PRIVATE' not in captured.err
    assert 'worker_failed' in captured.err and 'peak_rss_bytes' not in captured.err


def test_runbook_preserves_source_capacity_and_operator_hold():
    docs=(ROOT/'docs/operations/family-tree.md').read_text()
    for text in ['two heavy requests per ASGI process','2 × W × R','503 / `server_busy`',
                 'not a hard deadline','250 MiB expanded bytes is not a peak RSS ceiling',
                 'Operator memory-budget approval remains HOLD','286.21 MiB',
                 'portable.decode','portable.validate','media.sanitize',
                 '1,000 media','two\nconcurrent heavy requests','not metric\nlabels',
                 'No\nscheduler/alert transport/live threshold is installed']:
        assert text in docs
    assert 'not a deployment or activation record' in docs
