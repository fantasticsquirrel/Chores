from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


def _configure_test_settings(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "deployment_routing.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()


def _create_dist_tree(tmp_path: Path) -> Path:
    dist_dir = tmp_path / "dist"
    assets_dir = dist_dir / "assets"
    assets_dir.mkdir(parents=True)

    (dist_dir / "index.html").write_text("<!doctype html><html><body>chore app</body></html>", encoding="utf-8")
    (assets_dir / "app.js").write_text("console.log('ok');", encoding="utf-8")
    return dist_dir


def test_api_routes_are_namespaced_under_chore_api(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    app = create_app(frontend_dist_dir=_create_dist_tree(tmp_path))

    with TestClient(app) as client:
        prefixed_response = client.get("/chore-api/children")
        root_response = client.get("/children")

    assert prefixed_response.status_code == 401
    assert root_response.status_code == 404


def test_chore_path_serves_frontend_assets_and_spa_fallback(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    app = create_app(frontend_dist_dir=_create_dist_tree(tmp_path))

    with TestClient(app) as client:
        index_response = client.get("/chore/")
        route_response = client.get("/chore/parent/dashboard")
        asset_response = client.get("/chore/assets/app.js")

    assert index_response.status_code == 200
    assert "chore app" in index_response.text
    assert route_response.status_code == 200
    assert "chore app" in route_response.text
    assert asset_response.status_code == 200
    assert "console.log('ok');" in asset_response.text
