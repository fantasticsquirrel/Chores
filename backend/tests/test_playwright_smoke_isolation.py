from __future__ import annotations

from pathlib import Path

import pytest

from app.config import Settings, SettingsError
from app.startup import run_startup_checks


def _managed_database(tmp_path: Path) -> Path:
    managed_dir = tmp_path / "family-manager-playwright-isolation"
    managed_dir.mkdir(mode=0o700)
    managed_dir.chmod(0o700)
    marker = managed_dir / ".family-manager-smoke"
    marker.touch(mode=0o600)
    marker.chmod(0o600)
    return managed_dir / "chore_tracking.db"


def _settings(database_path: Path, *, app_env: str = "test", run_id: str = "") -> Settings:
    return Settings(
        app_env=app_env,
        database_url=f"sqlite:///{database_path}",
        secret_key="s" * 32,
        log_level="INFO",
        session_cookie_secure=app_env == "production",
        playwright_smoke_run_id=run_id,
    )


def test_startup_accepts_a_nonce_only_for_a_managed_disposable_playwright_database(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")

    run_startup_checks(_settings(_managed_database(tmp_path), run_id="n" * 32))


def test_startup_rejects_a_playwright_nonce_outside_the_managed_disposable_database(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")

    with pytest.raises(SettingsError, match="managed temporary directory"):
        run_startup_checks(_settings(tmp_path / "unmanaged.db", run_id="n" * 32))


def test_startup_rejects_a_playwright_nonce_in_production(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")

    with pytest.raises(SettingsError, match="non-production"):
        run_startup_checks(
            _settings(
                _managed_database(tmp_path),
                app_env="production",
                run_id="n" * 32,
            )
        )


def test_startup_rejects_a_short_playwright_nonce(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")

    with pytest.raises(SettingsError, match="PLAYWRIGHT_SMOKE_RUN_ID"):
        run_startup_checks(_settings(_managed_database(tmp_path), run_id="too-short"))
