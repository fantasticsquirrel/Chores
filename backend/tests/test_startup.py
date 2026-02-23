from __future__ import annotations

from pathlib import Path

from app.config import Settings, SettingsError
from app.startup import run_startup_checks
import pytest


def _settings(database_url: str, *, app_env: str = "development", secret_key: str = "a" * 32) -> Settings:
    return Settings(
        app_env=app_env,
        database_url=database_url,
        secret_key=secret_key,
        log_level="INFO",
        session_cookie_secure=False,
    )


def test_startup_checks_create_sqlite_directory(tmp_path: Path) -> None:
    db_file = tmp_path / "nested" / "tracker.db"
    settings = _settings(f"sqlite:///{db_file}")

    run_startup_checks(settings)

    assert db_file.parent.exists()


def test_startup_checks_reject_default_secret_in_production(tmp_path: Path) -> None:
    settings = _settings(
        f"sqlite:///{tmp_path / 'tracker.db'}",
        app_env="production",
        secret_key="dev-secret-key-change-me",
    )

    with pytest.raises(SettingsError, match="overridden in production"):
        run_startup_checks(settings)
