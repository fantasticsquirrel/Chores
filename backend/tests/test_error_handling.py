from __future__ import annotations

import asyncio
import logging
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import config as app_config
from app import error_handling
from app.config import get_settings
from app.error_handling import (
    PublicPasswordResetContainmentMiddleware,
    RequestLoggingMiddleware,
    register_exception_handlers,
)


def _build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(PublicPasswordResetContainmentMiddleware)
    register_exception_handlers(app)
    return app


def test_unhandled_exception_returns_standard_500_payload() -> None:
    app = _build_app()

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("failure")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/boom")

    assert response.status_code == 500
    assert response.json() == {"error": {"message": "Internal server error."}}


def test_unhandled_exception_logs_failure(caplog) -> None:
    app = _build_app()

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("failure")

    caplog.set_level(logging.ERROR, logger="app.error_handling")

    with TestClient(app, raise_server_exceptions=False) as client:
        client.get("/boom", headers={"X-Request-ID": "req-123"})

    assert "request.failed request_id=req-123 method=GET path=/boom" in caplog.text


def test_unhandled_password_reset_request_keeps_generic_acknowledgement_and_response_floor(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("PASSWORD_RESET_RESPONSE_FLOOR_MS", "40")
    get_settings.cache_clear()
    app = _build_app()

    @app.post("/chore-api/auth/password-reset/request")
    def boom() -> None:
        raise RuntimeError("request failure")

    try:
        # The public boundary must catch the route error before Starlette's outer
        # ServerErrorMiddleware can re-raise it to the ASGI host or server logs.
        with TestClient(app) as client:
            started = time.perf_counter()
            response = client.post(
                "/chore-api/auth/password-reset/request",
                json={"email": "parent@example.com"},
                headers={"X-Request-ID": "req-reset-boundary"},
            )
            elapsed = time.perf_counter() - started
    finally:
        get_settings.cache_clear()

    assert response.status_code == 202
    assert response.headers["X-Request-ID"] == "req-reset-boundary"
    assert response.json() == {"detail": "If an eligible account exists for that address, reset instructions will arrive shortly."}
    assert elapsed >= 0.03


@pytest.mark.parametrize(
    ("path", "payload", "detail"),
    [
        (
            "/chore-api/auth/password-reset/request",
            {"email": "parent@example.com"},
            "If an eligible account exists for that address, reset instructions will arrive shortly.",
        ),
        (
            "/chore-api/auth/password-reset/confirm",
            {"token": "test-reset-capability"},
            "Try signing in. If you cannot sign in, request a new reset link.",
        ),
    ],
)
def test_unhandled_password_reset_acknowledgement_survives_invalid_configured_floor(
    monkeypatch, path: str, payload: dict[str, str], detail: str
) -> None:
    class InvalidFloorSettings:
        password_reset_response_floor_ms = object()

    monkeypatch.setattr(app_config, "get_settings", lambda: InvalidFloorSettings())
    app = _build_app()

    @app.post(path)
    def boom() -> None:
        raise RuntimeError("reset route failure")

    with TestClient(app) as client:
        response = client.post(path, json=payload, headers={"X-Request-ID": "req-invalid-floor"})

    assert response.status_code == 202
    assert response.headers["X-Request-ID"] == "req-invalid-floor"
    assert response.json() == {"detail": detail}


def test_last_resort_password_reset_fallback_preserves_request_id(monkeypatch) -> None:
    original_acknowledgement = error_handling._password_reset_request_acknowledgement
    calls = 0

    async def fail_once_then_acknowledge(*, request_id: str | None = None):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("first acknowledgement failed")
        return await original_acknowledgement(request_id=request_id)

    monkeypatch.setattr(error_handling, "_password_reset_request_acknowledgement", fail_once_then_acknowledge)
    app = _build_app()

    @app.post("/chore-api/auth/password-reset/request")
    def boom() -> None:
        raise RuntimeError("reset route failure")

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/password-reset/request",
            json={"email": "parent@example.com"},
            headers={"X-Request-ID": "req-outer-fallback"},
        )

    assert calls == 1
    assert response.status_code == 202
    assert response.headers["X-Request-ID"] == "req-outer-fallback"


def test_public_reset_acknowledgement_survives_response_floor_sleep_failure(monkeypatch) -> None:
    async def failing_sleep(_: float) -> None:
        raise RuntimeError("floor sleep unavailable")

    monkeypatch.setattr(error_handling.asyncio, "sleep", failing_sleep)

    async def exercise() -> None:
        request = await error_handling._password_reset_request_acknowledgement()
        confirmation = await error_handling._password_reset_confirmation_acknowledgement()
        assert request.status_code == confirmation.status_code == 202
        assert request.body == b'{"detail":"If an eligible account exists for that address, reset instructions will arrive shortly."}'
        assert confirmation.body == b'{"detail":"Try signing in. If you cannot sign in, request a new reset link."}'

    asyncio.run(exercise())


def test_public_confirmation_acknowledgement_survives_admission_release_failure(monkeypatch) -> None:
    monkeypatch.setattr(error_handling.password_security, "acquire_password_reset_confirmation_budget", lambda: True)
    monkeypatch.setattr(error_handling.password_security, "burn_password_reset_confirmation_timing_budget", lambda: None)

    def failing_release() -> None:
        raise RuntimeError("admission release unavailable")

    monkeypatch.setattr(error_handling.password_security, "release_password_reset_confirmation_budget", failing_release)

    async def exercise() -> None:
        response = await error_handling._password_reset_confirmation_acknowledgement()
        assert response.status_code == 202
        assert response.body == b'{"detail":"Try signing in. If you cannot sign in, request a new reset link."}'

    asyncio.run(exercise())


def test_unhandled_password_reset_confirmation_hides_exception_and_raw_capability(caplog) -> None:
    app = _build_app()
    token = "v1.reset-row.super-secret-proof"

    @app.post("/chore-api/auth/password-reset/confirm")
    def boom() -> None:
        raise RuntimeError(f"raw reset capability: {token}")

    caplog.set_level(logging.ERROR, logger="app.error_handling")

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/password-reset/confirm",
            json={"token": token},
            headers={"X-Request-ID": "req-reset-confirm-boundary"},
        )

    assert response.status_code == 202
    assert response.headers["X-Request-ID"] == "req-reset-confirm-boundary"
    assert response.json() == {"detail": "Try signing in. If you cannot sign in, request a new reset link."}
    assert token not in caplog.text
    assert "password_reset.request_failed" in caplog.text


def test_request_logging_middleware_logs_completion(caplog) -> None:
    app = _build_app()

    @app.get("/ok")
    def ok() -> dict[str, str]:
        return {"status": "ok"}

    caplog.set_level(logging.INFO, logger="app.error_handling")

    with TestClient(app) as client:
        response = client.get("/ok", headers={"X-Request-ID": "req-456"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "req-456"
    assert "request.completed request_id=req-456 method=GET path=/ok status=200" in caplog.text
