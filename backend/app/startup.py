from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

from app.config import Settings, SettingsError


def run_startup_checks(settings: Settings) -> None:
    _validate_security(settings)
    _validate_database_path(settings.database_url)


def _validate_security(settings: Settings) -> None:
    if settings.is_production and settings.secret_key == "dev-secret-key-change-me":
        raise SettingsError("SECRET_KEY must be overridden in production.")


def _validate_database_path(database_url: str) -> None:
    parsed = urlparse(database_url)
    if parsed.scheme != "sqlite":
        return

    raw_path = parsed.path
    if database_url.startswith("sqlite:///./"):
        raw_path = database_url.replace("sqlite:///", "", 1)

    db_path = Path(raw_path).expanduser().resolve()
    db_dir = db_path.parent

    db_dir.mkdir(parents=True, exist_ok=True)
    if not os.access(db_dir, os.W_OK):
        raise SettingsError(f"Database directory is not writable: {db_dir}")
