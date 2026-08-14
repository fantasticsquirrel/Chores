from __future__ import annotations

from pathlib import Path
import os
import stat
import tempfile


REPO_ROOT = Path(__file__).resolve().parents[2]
PRODUCTION_DATABASE = (REPO_ROOT / "data" / "chore_tracking.db").resolve()
_SQLITE_FILENAME_PREFIX = "sqlite:///"


def _isolated_database_path_from_url(database_url: str) -> Path:
    """Accept only an unambiguous SQLite filename URL before filesystem checks."""
    if not database_url.startswith(_SQLITE_FILENAME_PREFIX):
        raise RuntimeError("Smoke fixtures require an isolated SQLite database.")

    raw_path = database_url.removeprefix(_SQLITE_FILENAME_PREFIX)
    # A SQLAlchemy SQLite URI may interpret these components differently than
    # pathlib. Reject them rather than validate one pathname and open another.
    if not raw_path or any(character in raw_path for character in ("?", "#", "%", "\x00")):
        raise RuntimeError("Smoke fixtures require a canonical SQLite filename URL.")
    if raw_path.startswith("/"):
        untrusted_path = Path(raw_path).expanduser()
    else:
        untrusted_path = REPO_ROOT / raw_path
    # Normalize dot segments without resolving symlinks first: the checks below
    # must inspect the wrapper-provided directory and marker themselves.
    return Path(os.path.abspath(str(untrusted_path)))


def _matches_production_database(database_stat: os.stat_result) -> bool:
    try:
        production_stat = PRODUCTION_DATABASE.stat()
    except FileNotFoundError:
        return False
    return os.path.samestat(database_stat, production_stat)


def require_isolated_smoke_database(database_url: str) -> Path:
    """Fail closed before any browser-smoke fixture can mutate a database."""
    if os.getenv("PLAYWRIGHT_ISOLATED_DB") != "1":
        raise RuntimeError("PLAYWRIGHT_ISOLATED_DB=1 is required for smoke fixture seeding.")

    database_path = _isolated_database_path_from_url(database_url)
    resolved_database_path = database_path.resolve()
    if resolved_database_path == PRODUCTION_DATABASE:
        raise RuntimeError("Smoke fixtures must never use the production database.")

    temp_root = Path(tempfile.gettempdir()).resolve()
    parent = database_path.parent
    try:
        relative_parent = parent.relative_to(temp_root)
        resolved_database_path.parent.relative_to(temp_root)
    except ValueError as exc:
        raise RuntimeError("Smoke fixtures require a managed temporary directory.") from exc
    if not parent.name.startswith("family-manager-playwright-"):
        raise RuntimeError("Smoke fixtures require a managed temporary directory.")
    # Reject every symlink between the system temp root and the disposable
    # directory. A resolved-only check would otherwise hide an attacker-created
    # path substitution before marker ownership is examined.
    current = temp_root
    try:
        for component in relative_parent.parts:
            current /= component
            if stat.S_ISLNK(current.lstat().st_mode):
                raise RuntimeError("Smoke fixtures require a managed temporary directory.")
        parent_stat = parent.lstat()
        marker_stat = (parent / ".family-manager-smoke").lstat()
    except OSError as exc:
        raise RuntimeError("Smoke fixtures require a managed temporary directory.") from exc
    if (
        not stat.S_ISDIR(parent_stat.st_mode)
        or stat.S_ISLNK(parent_stat.st_mode)
        or parent_stat.st_uid != os.geteuid()
        or stat.S_IMODE(parent_stat.st_mode) != 0o700
        or not stat.S_ISREG(marker_stat.st_mode)
        or stat.S_ISLNK(marker_stat.st_mode)
        or marker_stat.st_uid != os.geteuid()
        or stat.S_IMODE(marker_stat.st_mode) != 0o600
        or marker_stat.st_nlink != 1
    ):
        raise RuntimeError("Smoke fixtures require a managed temporary directory.")
    try:
        database_stat = database_path.lstat()
    except FileNotFoundError:
        pass
    else:
        if _matches_production_database(database_stat):
            raise RuntimeError("Smoke fixtures must never use the production database.")
        if (
            not stat.S_ISREG(database_stat.st_mode)
            or stat.S_ISLNK(database_stat.st_mode)
            or database_stat.st_uid != os.geteuid()
            or database_stat.st_nlink != 1
        ):
            raise RuntimeError("Smoke fixtures require a managed temporary directory.")
    return resolved_database_path


def canonical_isolated_smoke_database_url(database_url: str) -> str:
    """Return the exact filename URL that follows the completed safety check."""
    return f"sqlite:///{require_isolated_smoke_database(database_url)}"
