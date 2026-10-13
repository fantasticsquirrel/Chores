"""Configured private immutable objects; no remote fetch or caller-selected paths.

All writers hold a shared store lock through SQL publication; orphan sweeping
holds the exclusive lock. Database deletion claims coordinate live assets.
"""
import contextlib
import fcntl
import hashlib
import os
from pathlib import Path
import re
import secrets
import shutil
import time
from .access import error

MAX_IMAGE = 10 * 1024 * 1024
MAX_PIXELS = 25_000_000
MAX_INPUT = 100 * 1024 * 1024
MAX_EXPANDED = 250 * 1024 * 1024
MAX_MANIFEST = 16 * 1024 * 1024


def limit(name, default):
    # Operators may reduce limits, never silently exceed the audited ceilings.
    raw = os.getenv('FAMILY_TREE_' + name, str(default))
    try:
        value = int(raw)
        if not 1 <= value <= default: raise ValueError()
        return value
    except ValueError:
        error('storage_unavailable', 'Invalid private storage configuration.', 503)


def root():
    value = os.getenv('FAMILY_TREE_STORAGE_ROOT')
    if not value or not Path(value).is_absolute():
        error('storage_unavailable', 'Private Family Tree storage is not configured.', 503)
    path = Path(value)
    # Reject symlinked ancestors, including the configured root itself.
    if any(p.is_symlink() for p in [path, *path.parents]):
        error('storage_unavailable', 'Private Family Tree storage is unavailable.', 503)
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path, 0o700)
    for name in ['objects', 'artifacts', 'staging']:
        directory = path / name
        if directory.is_symlink(): error('storage_unavailable', 'Private storage is unavailable.', 503)
        directory.mkdir(mode=0o700, exist_ok=True)
        os.chmod(directory, 0o700)
    return path


@contextlib.contextmanager
def lock(exclusive=False):
    path = root()
    fd = os.open(path / '.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        deadline=time.monotonic()+5
        while True:
            try:
                fcntl.flock(fd, (fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH)|fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic()>=deadline: error('server_busy','Private storage is busy. Retry later.',503)
                time.sleep(0.025)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def path(key, area='objects'):
    if area not in {'objects', 'artifacts', 'staging'} or not re.fullmatch(r'[a-f0-9]{64}', key):
        error('storage_unavailable', 'Invalid managed object.', 503)
    return root() / area / key


def write(data, area='objects'):
    if shutil.disk_usage(root()).free<len(data)+256*1024*1024:
        error('resource_limit','Private storage capacity is unavailable.',413)
    key = secrets.token_hex(32)
    destination = path(key, area)
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data); stream.flush(); os.fsync(stream.fileno())
        d = os.open(destination.parent, os.O_RDONLY | os.O_DIRECTORY)
        try: os.fsync(d)
        finally: os.close(d)
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    return key


def read(key, area='objects', ceiling=MAX_IMAGE):
    try:
        fd = os.open(path(key, area), os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, 'rb') as stream:
            data = stream.read(ceiling + 1)
        if len(data) > ceiling: error('resource_limit', 'Managed content exceeds its bound.', 413)
        return data
    except OSError:
        error('media_unavailable', 'Managed content is unavailable.', 409)


def open_read(key, area='objects'):
    try: return os.fdopen(os.open(path(key, area), os.O_RDONLY | os.O_NOFOLLOW), 'rb')
    except OSError: error('media_unavailable', 'Managed content is unavailable.')


def file_checksum(stream):
    h = hashlib.sha256()
    while data := stream.read(64 * 1024): h.update(data)
    return h.hexdigest()


def unlink(key, area='objects'):
    path(key, area).unlink(missing_ok=True)


def checksum(data):
    return hashlib.sha256(data).hexdigest()


async def stage_upload(upload, maximum):
    key = secrets.token_hex(32)
    destination = path(key, 'staging')
    total = 0
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'wb') as stream:
            while chunk := await upload.read(64 * 1024):
                total += len(chunk)
                if total > maximum: error('resource_limit', 'Upload exceeds the permitted size.', 413)
                stream.write(chunk)
            stream.flush(); os.fsync(stream.fileno())
        return key
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await upload.close()
