from __future__ import annotations

import asyncio
import logging
import time
import uuid
from collections.abc import Callable

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.security import passwords as password_security
from app.security.csrf import CSRF_COOKIE_NAME, CSRF_HEADER_NAME, is_valid_csrf_token
from app.security.sessions import SESSION_COOKIE_NAME

logger = logging.getLogger(__name__)

_PASSWORD_RESET_REQUEST_PATH = "/chore-api/auth/password-reset/request"
_PASSWORD_RESET_CONFIRM_PATH = "/chore-api/auth/password-reset/confirm"
_PASSWORD_RESET_REQUEST_ACK = "If an eligible account exists for that address, reset instructions will arrive shortly."
_PASSWORD_RESET_CONFIRM_ACK = "Try signing in. If you cannot sign in, request a new reset link."


async def _best_effort_public_response_floor(started_at: float, floor_ms: int) -> None:
    """Apply a public timing floor without allowing equalization failure to escape."""
    try:
        remaining = floor_ms / 1000 - (time.perf_counter() - started_at)
        if remaining > 0:
            await asyncio.sleep(remaining)
    except Exception:
        # Timing equalization is defense in depth; its own transient failure must
        # never turn a public reset acknowledgement into an error/oracle.
        return


def _public_password_reset_response(detail: str, *, request_id: str | None = None) -> JSONResponse:
    """Build a generic reset acknowledgement safe even when inner middleware failed.

    A route exception can bypass the ordinary security-header middleware while
    unwinding to the outer public-error boundary. The acknowledgement therefore
    owns the public API's no-cache/referrer/frame/type protections as a fallback.
    """
    response = JSONResponse(status_code=202, content={"detail": detail})
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    if request_id is not None:
        response.headers["X-Request-ID"] = request_id
    return response


async def _password_reset_request_acknowledgement(*, request_id: str | None = None) -> JSONResponse:
    """Return the uniform request acknowledgement within the public time floor."""
    started_at = time.perf_counter()
    floor_ms = 100
    try:
        from app.config import get_settings

        floor_ms = get_settings().password_reset_response_floor_ms
    except Exception:
        pass
    await _best_effort_public_response_floor(started_at, floor_ms)
    return _public_password_reset_response(_PASSWORD_RESET_REQUEST_ACK, request_id=request_id)


async def _password_reset_confirmation_acknowledgement(*, request_id: str | None = None) -> JSONResponse:
    """Return the uniform completion acknowledgement within the public time floor.

    Framework/schema errors bypass the route's normal confirmation handler, so
    they must retain both its Argon2-class timing work and its configured response
    floor.  The fallback floor remains effective even if the timing pad itself
    cannot run; errors never change the acknowledgement.
    """
    started_at = time.perf_counter()
    admitted = False
    try:
        # Framework validation exceptions bypass the route, so they must use
        # the identical non-blocking admission budget as normal confirmations.
        admitted = password_security.acquire_password_reset_confirmation_budget()
        if admitted:
            password_security.burn_password_reset_confirmation_timing_budget()
    except Exception:
        pass
    finally:
        if admitted:
            try:
                password_security.release_password_reset_confirmation_budget()
            except Exception:
                # This accounting release is defense in depth. A transient
                # failure must not convert a generic public acknowledgement
                # into an externally visible error/oracle.
                logger.warning("password_reset.confirmation_admission_release_failed")
    floor_ms = 100
    try:
        from app.config import get_settings

        floor_ms = get_settings().password_reset_response_floor_ms
    except Exception:
        pass
    await _best_effort_public_response_floor(started_at, floor_ms)
    return _public_password_reset_response(_PASSWORD_RESET_CONFIRM_ACK, request_id=request_id)

def _last_resort_password_reset_response(path: str, *, request_id: str) -> JSONResponse:
    """Return a public reset acknowledgement without invoking fallible helpers."""
    if path == _PASSWORD_RESET_REQUEST_PATH:
        return _public_password_reset_response(_PASSWORD_RESET_REQUEST_ACK, request_id=request_id)
    return _public_password_reset_response(_PASSWORD_RESET_CONFIRM_ACK, request_id=request_id)


class PublicPasswordResetContainmentMiddleware(BaseHTTPMiddleware):
    """Keep reset failures inside the user-middleware stack, not ServerErrorMiddleware."""

    async def dispatch(self, request: Request, call_next: Callable):  # type: ignore[override]
        try:
            return await call_next(request)
        except Exception:
            # Do not catch BaseException: ASGI cancellation must continue to
            # propagate instead of being converted to a public acknowledgement.
            path = request.url.path
            if path not in {_PASSWORD_RESET_REQUEST_PATH, _PASSWORD_RESET_CONFIRM_PATH}:
                raise
            request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
            return _last_resort_password_reset_response(path, request_id=request_id)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):  # type: ignore[override]
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            # Catch ordinary public reset failures here; if this acknowledgement
            # path itself fails, the outer reset-only containment middleware
            # returns the last-resort response before ServerErrorMiddleware.
            # Exception deliberately excludes cancellation.
            if request.url.path == _PASSWORD_RESET_REQUEST_PATH:
                logger.error(
                    "password_reset.request_failed request_id=%s method=%s path=%s",
                    request_id,
                    request.method,
                    request.url.path,
                )
                response = await _password_reset_request_acknowledgement()
            elif request.url.path == _PASSWORD_RESET_CONFIRM_PATH:
                logger.error(
                    "password_reset.request_failed request_id=%s method=%s path=%s",
                    request_id,
                    request.method,
                    request.url.path,
                )
                response = await _password_reset_confirmation_acknowledgement()
            else:
                raise
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
    # Reset capabilities authorize these public recovery operations themselves.
    # They must remain usable if a browser retains an unrelated stale session
    # cookie; all other authenticated mutations continue to require CSRF.
    _exempt_paths = {
        "/chore-api/auth/login",
        "/chore-api/auth/child-login",
        "/chore-api/auth/password-reset/request",
        "/chore-api/auth/password-reset/confirm",
    }

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
    @app.exception_handler(RequestValidationError)
    async def password_reset_validation_error_handler(request: Request, error: RequestValidationError) -> JSONResponse:
        # A malformed public recovery request must not become a field-level
        # oracle. The opaque reset capability similarly gets one public error.
        if request.url.path == _PASSWORD_RESET_REQUEST_PATH:
            # Keep malformed JSON/schema failures within the same timing envelope
            # as ordinary generic recovery requests.
            return await _password_reset_request_acknowledgement()
        if request.url.path == _PASSWORD_RESET_CONFIRM_PATH:
            return await _password_reset_confirmation_acknowledgement()
        return await request_validation_exception_handler(request, error)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        # Reset capabilities are supplied only in request bodies/fragments. Do
        # not hand an exception object to a logger for these routes: framework
        # validation/transport details could otherwise retain the raw body.
        if request.url.path in {_PASSWORD_RESET_REQUEST_PATH, _PASSWORD_RESET_CONFIRM_PATH}:
            logger.error(
                "password_reset.request_failed request_id=%s method=%s path=%s",
                request_id,
                request.method,
                request.url.path,
            )
            if request.url.path == _PASSWORD_RESET_REQUEST_PATH:
                return await _password_reset_request_acknowledgement(request_id=request_id)
            return await _password_reset_confirmation_acknowledgement(request_id=request_id)
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
