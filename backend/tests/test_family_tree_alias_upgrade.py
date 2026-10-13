"""Actual predecessor authenticated APIs followed by isolated forward upgrades.

The old application runs alone against archived immutable backend source. An
optional FAMILY_TREE_PREDECESSOR_CHECKOUT must match the pinned revision. No
old/live modules are overlaid and the default needs no machine-specific path.
"""
import os
import io
from pathlib import Path
import subprocess
import sys
import tarfile

import pytest

PREDECESSOR_SHA = 'e6ffe2f555258d89b51a6026ab3f1d05de4e5332'


@pytest.fixture(scope='session')
def predecessor_checkout(tmp_path_factory):
    configured = os.environ.get('FAMILY_TREE_PREDECESSOR_CHECKOUT')
    if configured:
        predecessor = Path(configured)
        identity = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=predecessor,
                                  text=True, capture_output=True, check=True)
        assert identity.stdout.strip() == PREDECESSOR_SHA
        assert subprocess.run(['git', 'status', '--porcelain', '--untracked-files=no'],
                              cwd=predecessor, text=True, capture_output=True, check=True).stdout == ''
        return predecessor
    # CI fetches complete history. Archive only the immutable backend into a
    # private fixture directory; no worktree/Git mutation or dependency copies.
    repository = Path(__file__).resolve().parents[2]
    archived = subprocess.run(['git', 'archive', '--format=tar', PREDECESSOR_SHA,
                              'backend', 'packages/family-api/module-contract.json'],
                              cwd=repository, capture_output=True, check=True, timeout=30)
    predecessor = tmp_path_factory.mktemp('alias-predecessor-source')
    with tarfile.open(fileobj=io.BytesIO(archived.stdout)) as archive:
        for member in archive.getmembers():
            if member.isdir():
                continue
            assert member.isfile(), 'Predecessor archive must contain regular source files only.'
            target = predecessor / member.name
            assert target.resolve().is_relative_to(predecessor.resolve())
            stream = archive.extractfile(member)
            assert stream is not None
            target.parent.mkdir(parents=True, exist_ok=True)
            with stream:
                target.write_bytes(stream.read())
    return predecessor


@pytest.mark.parametrize('start', ['25', '26'])
@pytest.mark.parametrize('evidence', ['intact', 'cleanup', 'deleted'])
def test_actual_predecessor_alias_upgrade(tmp_path, start, evidence, predecessor_checkout):
    root = Path(__file__).resolve().parents[1]
    predecessor = predecessor_checkout
    helper = root / 'tests' / 'alias_upgrade_probe.py'
    env = {**os.environ, 'APP_ENV': 'test', 'PYTHONDONTWRITEBYTECODE': '1',
           'DATABASE_URL': f'sqlite:///{tmp_path / "tree.sqlite"}',
           'SECRET_KEY': 'a' * 32, 'SESSION_COOKIE_SECURE': 'false',
           'FAMILY_TREE_STORAGE_ROOT': str(tmp_path / 'private')}
    for mode, checkout, option in [('seed', predecessor / 'backend', evidence), ('verify', root, start)]:
        env['PYTHONPATH'] = f'{checkout}:{checkout / "tests"}'
        result = subprocess.run([sys.executable, str(helper), mode, str(tmp_path), option],
                                cwd=checkout, env=env, text=True, capture_output=True, timeout=90)
        assert result.returncode == 0, f'{mode}:\n{result.stdout}\n{result.stderr}'
        if mode == 'verify':
            print(result.stdout)
