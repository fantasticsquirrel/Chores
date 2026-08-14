from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app import error_handling
from app.api import auth as auth_api
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

def test_reset_route_uses_no_store_no_referrer_restrictive_csp_and_never_trusts_forwarded_hsts(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    app = create_app(frontend_dist_dir=_create_dist_tree(tmp_path))

    with TestClient(app) as client:
        response = client.get("/chore/reset-password", headers={"X-Forwarded-Proto": "https"})

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["Content-Security-Policy"] == (
        "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; "
        "object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self';"
    )
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "Strict-Transport-Security" not in response.headers


def test_unhandled_reset_request_keeps_public_security_headers(tmp_path: Path, monkeypatch) -> None:
    """The app middleware stack must decorate generic reset failures too."""
    _configure_test_settings(tmp_path, monkeypatch)

    def failing_password_reset_service() -> object:
        raise RuntimeError("reset service unavailable")

    monkeypatch.setattr(auth_api, "_password_reset_service", failing_password_reset_service)
    app = create_app(frontend_dist_dir=_create_dist_tree(tmp_path))

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/password-reset/request",
            json={"email": "parent@example.com"},
            headers={"X-Request-ID": "req-reset-security-headers"},
        )

    assert response.status_code == 202
    assert response.headers["X-Request-ID"] == "req-reset-security-headers"
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"


def test_last_resort_reset_failure_stays_inside_asgi_boundary(tmp_path: Path, monkeypatch) -> None:
    """A broken normal acknowledgement must not reach ServerErrorMiddleware."""
    _configure_test_settings(tmp_path, monkeypatch)
    original_acknowledgement = error_handling._password_reset_request_acknowledgement
    acknowledgement_calls = 0

    async def fail_once_then_acknowledge(*, request_id: str | None = None):
        nonlocal acknowledgement_calls
        acknowledgement_calls += 1
        if acknowledgement_calls == 1:
            raise RuntimeError("normal acknowledgement unavailable")
        return await original_acknowledgement(request_id=request_id)

    def failing_password_reset_service() -> object:
        raise RuntimeError("reset service unavailable")

    monkeypatch.setattr(error_handling, "_password_reset_request_acknowledgement", fail_once_then_acknowledge)
    monkeypatch.setattr(auth_api, "_password_reset_service", failing_password_reset_service)
    app = create_app(frontend_dist_dir=_create_dist_tree(tmp_path))

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/password-reset/request",
            json={"email": "parent@example.com"},
            headers={"X-Request-ID": "req-last-resort"},
        )

    assert acknowledgement_calls == 1
    assert response.status_code == 202
    assert response.headers["X-Request-ID"] == "req-last-resort"
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"


def test_reset_route_trailing_slash_uses_the_same_no_store_no_referrer_and_restrictive_csp(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    app = create_app(frontend_dist_dir=_create_dist_tree(tmp_path))

    with TestClient(app) as client:
        response = client.get("/chore/reset-password/", headers={"X-Forwarded-Proto": "https"})

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["Content-Security-Policy"] == (
        "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; "
        "object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self';"
    )
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "Strict-Transport-Security" not in response.headers


def test_security_headers_exclude_hsts_when_forwarded_proto_is_spoofed(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text("<html>Family Manager</html>", encoding="utf-8")
    app = create_app(frontend_dist_dir=dist_dir)

    with TestClient(app) as client:
        response = client.get("/chore/", headers={"X-Forwarded-Proto": "https"})

    assert response.status_code == 200
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "same-origin"
    assert "Strict-Transport-Security" not in response.headers

