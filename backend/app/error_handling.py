from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Callable

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.security.csrf import CSRF_COOKIE_NAME, CSRF_HEADER_NAME, is_valid_csrf_token
from app.security.sessions import SESSION_COOKIE_NAME

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):  # type: ignore[override]
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request.completed request_id=%s method=%s path=%s status=%s duration_ms=%.2f",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response


class CsrfProtectionMiddleware(BaseHTTPMiddleware):
    _unsafe_methods = {"POST", "PUT", "PATCH", "DELETE"}
    _exempt_paths = {"/chore-api/auth/login", "/chore-api/auth/child-login"}

    async def dispatch(self, request: Request, call_next: Callable):  # type: ignore[override]
        if request.method not in self._unsafe_methods:
            return await call_next(request)

        path = request.url.path
        if not path.startswith("/chore-api") or path in self._exempt_paths:
            return await call_next(request)

        session_token = request.cookies.get(SESSION_COOKIE_NAME)
        if session_token is None:
            return await call_next(request)

        csrf_cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
        csrf_header_token = request.headers.get(CSRF_HEADER_NAME)
        if not is_valid_csrf_token(csrf_cookie_token, csrf_header_token):
            return JSONResponse(status_code=403, content={"detail": "CSRF token missing or invalid."})

        return await call_next(request)


def _error_payload(message: str) -> dict[str, dict[str, str]]:
    return {"error": {"message": message}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = request.headers.get("X-Request-ID")
        logger.exception(
            "request.failed request_id=%s method=%s path=%s",
            request_id,
            request.method,
            request.url.path,
            exc_info=exc,
        )
        return JSONResponse(
            status_code=500,
            content=_error_payload("Internal server error."),
        )
