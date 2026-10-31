"""Actual predecessor authenticated APIs followed by isolated forward upgrades.

The old application runs alone against an integrity-checked source archive made
from the pinned predecessor commit. An optional FAMILY_TREE_PREDECESSOR_CHECKOUT
must match that revision. No old/live modules are overlaid and the default does
not depend on remote Git history or a machine-specific path.
"""
import hashlib
import os
import json
from pathlib import Path
from pathlib import PurePosixPath
import subprocess
import sys
import tarfile

import pytest

PREDECESSOR_SHA = 'e6ffe2f555258d89b51a6026ab3f1d05de4e5332'
PREDECESSOR_TREE = '618c7767ded32a9c073a2dcdbe2bc30f2360253b'
PREDECESSOR_ARCHIVE_SHA256 = 'e882ef1c283cb3e463a158870ff6815d58621de7d0dac2b4bf950bccb38c2dac'
FIXTURE_ROOT = Path(__file__).with_name('fixtures') / 'family_tree_predecessor'
PROVENANCE_PATH = FIXTURE_ROOT / 'provenance.json'


def _extract_predecessor_fixture(destination):
    provenance = json.loads(PROVENANCE_PATH.read_text(encoding='utf-8'))
    assert provenance == {
        'archive': 'source-e6ffe2f555258d89b51a6026ab3f1d05de4e5332.tar.gz',
        'archive_sha256': PREDECESSOR_ARCHIVE_SHA256,
        'compression': 'gzip -n -9',
        'included_paths': ['backend', 'packages/family-api/module-contract.json'],
        'source_commit': PREDECESSOR_SHA,
        'source_parent': '52ff3bd8263977bf089e49ddac8537ceb364c792',
        'source_subject': 'feat: add safe family tree observability and capacity reference',
        'source_tree': PREDECESSOR_TREE,
    }
    archive_path = FIXTURE_ROOT / provenance['archive']
    assert hashlib.sha256(archive_path.read_bytes()).hexdigest() == PREDECESSOR_ARCHIVE_SHA256
    with tarfile.open(archive_path, mode='r:gz') as archive:
        # git archive records the source commit in its global PAX header.
        assert archive.pax_headers.get('comment') == PREDECESSOR_SHA
        for member in archive.getmembers():
            path = PurePosixPath(member.name)
            assert not path.is_absolute() and '..' not in path.parts
            assert (member.name in {'backend', 'packages', 'packages/family-api'}
                    or member.name.startswith('backend/')
                    or member.name == 'packages/family-api/module-contract.json')
            if member.isdir():
                continue
            assert member.isfile(), 'Predecessor archive must contain regular source files only.'
            target = destination.joinpath(*path.parts)
            assert target.resolve().is_relative_to(destination.resolve())
            stream = archive.extractfile(member)
            assert stream is not None
            target.parent.mkdir(parents=True, exist_ok=True)
            with stream:
                target.write_bytes(stream.read())


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
    # The source commit lived on a deleted branch, so ordinary CI fetches cannot
    # promise that its object remains reachable. The checked archive retains the
    # exact source needed by these predecessor tests without weakening the pin.
    predecessor = tmp_path_factory.mktemp('alias-predecessor-source')
    _extract_predecessor_fixture(predecessor)
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
