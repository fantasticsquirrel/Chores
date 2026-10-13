"""Real immutable predecessor record-provenance merge upgrade regressions."""
import os
from pathlib import Path
import subprocess
import sys

import pytest

from test_family_tree_alias_upgrade import predecessor_checkout


@pytest.mark.parametrize('start', ['25', '26', '27'])
@pytest.mark.parametrize('evidence', ['intact', 'missing-receipt', 'missing-source', 'missing-audit'])
def test_record_provenance_merge_origin_upgrade(tmp_path, start, evidence, predecessor_checkout):
    backend = Path(__file__).resolve().parents[1]
    helper = backend / 'tests/source_origin_upgrade_probe.py'
    env = {**os.environ, 'APP_ENV': 'test', 'PYTHONDONTWRITEBYTECODE': '1',
           'DATABASE_URL': f'sqlite:///{tmp_path / "tree.sqlite"}',
           'SECRET_KEY': 'a' * 32, 'SESSION_COOKIE_SECURE': 'false',
           'FAMILY_TREE_STORAGE_ROOT': str(tmp_path / 'private')}
    for mode, checkout, option in [('seed', predecessor_checkout / 'backend', evidence),
                                   ('verify', backend, start)]:
        env['PYTHONPATH'] = f'{checkout}:{checkout / "tests"}'
        result = subprocess.run([sys.executable, str(helper), mode, str(tmp_path), option],
                                cwd=checkout, env=env, text=True, capture_output=True, timeout=90)
        (tmp_path / f'{mode}.log').write_text(result.stdout + result.stderr)
        assert result.returncode == 0, f'{mode}:\n{result.stdout}\n{result.stderr}'
        if mode == 'verify':
            print(result.stdout)
