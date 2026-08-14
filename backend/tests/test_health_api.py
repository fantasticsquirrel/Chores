from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
import app.health as health


def _configure_test_settings(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "health_api.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()


def test_liveness_healthcheck_returns_ok(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_healthcheck_returns_database_check(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "checks": {"database": {"status": "ok"}}}


def test_readiness_healthcheck_echoes_the_wrapper_nonce_only_for_an_owned_smoke_backend(tmp_path: Path, monkeypatch) -> None:
    smoke_dir = tmp_path / "family-manager-playwright-health"
    smoke_dir.mkdir(mode=0o700)
    smoke_dir.chmod(0o700)
    marker = smoke_dir / ".family-manager-smoke"
    marker.touch(mode=0o600)
    marker.chmod(0o600)
    nonce = "n" * 32
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{smoke_dir / 'health_api.db'}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")
    monkeypatch.setenv("PLAYWRIGHT_SMOKE_RUN_ID", nonce)
    get_settings.cache_clear()

    with TestClient(app) as client:
        response = client.get("/chore-api/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "checks": {"database": {"status": "ok"}},
        "playwright_smoke_run_id": nonce,
    }


def test_readiness_healthcheck_returns_503_when_database_unavailable(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    def _unavailable(_: str) -> tuple[bool, str | None]:
        return False, "Database unavailable."

    monkeypatch.setattr(health, "check_database", _unavailable)

    with TestClient(app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "degraded",
        "checks": {"database": {"status": "error", "message": "Database unavailable."}},
    }
