from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.error_handling import RequestLoggingMiddleware, register_exception_handlers


def _build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)
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
        client.get("/boom")

    assert "request.failed method=GET path=/boom" in caplog.text


def test_request_logging_middleware_logs_completion(caplog) -> None:
    app = _build_app()

    @app.get("/ok")
    def ok() -> dict[str, str]:
        return {"status": "ok"}

    caplog.set_level(logging.INFO, logger="app.error_handling")

    with TestClient(app) as client:
        response = client.get("/ok")

    assert response.status_code == 200
    assert "request.completed method=GET path=/ok status=200" in caplog.text
