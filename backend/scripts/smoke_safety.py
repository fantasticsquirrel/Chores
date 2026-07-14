from __future__ import annotations

import os
from pathlib import Path
import tempfile


REPO_ROOT = Path(__file__).resolve().parents[2]
PRODUCTION_DATABASE = (REPO_ROOT / "data" / "chore_tracking.db").resolve()


def require_isolated_smoke_database(database_url: str) -> Path:
    """Fail closed before any browser-smoke fixture can mutate a database."""
    if os.getenv("PLAYWRIGHT_ISOLATED_DB") != "1":
        raise RuntimeError("PLAYWRIGHT_ISOLATED_DB=1 is required for smoke fixture seeding.")
    if not database_url.startswith("sqlite:///"):
        raise RuntimeError("Smoke fixtures require an isolated SQLite database.")

    raw_path = database_url.removeprefix("sqlite:///")
    if raw_path.startswith("/"):
        database_path = Path(raw_path).expanduser().resolve()
    else:
        database_path = (REPO_ROOT / raw_path).expanduser().resolve()
    if database_path == PRODUCTION_DATABASE:
        raise RuntimeError("Smoke fixtures must never use the production database.")

    temp_root = Path(tempfile.gettempdir()).resolve()
    parent = database_path.parent
    try:
        parent.relative_to(temp_root)
    except ValueError as exc:
        raise RuntimeError("Smoke fixtures require a managed temporary directory.") from exc
    if not parent.name.startswith("family-manager-playwright-") or not (parent / ".family-manager-smoke").is_file():
        raise RuntimeError("Smoke fixtures require a managed temporary directory.")
    return database_path
