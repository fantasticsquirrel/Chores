from __future__ import annotations

from pathlib import Path

from sqlalchemy import text

from app.config import Settings, SettingsError
from app.db import get_engine, initialize_database
import pytest


def _settings(database_url: str, *, app_env: str = "test") -> Settings:
    return Settings(
        app_env=app_env,
        database_url=database_url,
        secret_key="a" * 32,
        log_level="INFO",
        session_cookie_secure=False,
    )


def test_initialize_database_creates_sqlite_file(tmp_path: Path) -> None:
    db_file = tmp_path / "storage" / "tracker.db"
    settings = _settings(f"sqlite:///{db_file}")

    initialize_database(settings)

    assert db_file.exists()


def test_initialize_database_rejects_unmigrated_production_schema(tmp_path: Path) -> None:
    db_file = tmp_path / "production.db"
    settings = _settings(f"sqlite:///{db_file}", app_env="production")

    with pytest.raises(SettingsError, match="alembic upgrade head"):
        initialize_database(settings)

    engine = get_engine(settings.database_url)
    with engine.connect() as connection:
        tables = connection.execute(text("SELECT name FROM sqlite_master WHERE type = 'table' AND name != 'alembic_version'"))
        assert tables.all() == []


def test_sqlite_storage_pragmas_enabled(tmp_path: Path) -> None:
    db_file = tmp_path / "tracker.db"
    database_url = f"sqlite:///{db_file}"
    settings = _settings(database_url)

    initialize_database(settings)

    engine = get_engine(database_url)
    with engine.connect() as connection:
        journal_mode = connection.execute(text("PRAGMA journal_mode;")).scalar_one()
        foreign_keys = connection.execute(text("PRAGMA foreign_keys;")).scalar_one()

    assert str(journal_mode).lower() == "wal"
    assert int(foreign_keys) == 1
