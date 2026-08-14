from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse
from fastapi.responses import JSONResponse

from app.api import auth_router, billing_router, children_router, chores_router, homeschool_router, households_router, modules_router, notifications_router, ops_router, recipes_router, workflow_router
from app.config import get_settings
from app.db import initialize_database
from app.error_handling import (
    CsrfProtectionMiddleware,
    PublicPasswordResetContainmentMiddleware,
    RequestLoggingMiddleware,
    register_exception_handlers,
)
from app.health import build_readiness_payload
from app.logging_config import configure_logging
from app.startup import run_startup_checks

API_PREFIX = "/chore-api"
FRONTEND_BASE_PATH = "/chore"
RESET_FRONTEND_PATHS = frozenset(
    {
        f"{FRONTEND_BASE_PATH}/reset-password",
        f"{FRONTEND_BASE_PATH}/reset-password/",
    }
)
RESET_PUBLIC_API_PATHS = frozenset(
    {
        f"{API_PREFIX}/auth/password-reset/request",
        f"{API_PREFIX}/auth/password-reset/confirm",
    }
)
RESET_CONTENT_SECURITY_POLICY = (
    "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; "
    "object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self';"
)
DEFAULT_FRONTEND_DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    run_startup_checks(settings)
    initialize_database(settings)
    yield


def create_app(frontend_dist_dir: Path | None = None) -> FastAPI:
    app = FastAPI(title="Family Manager API", version="0.1.0", lifespan=lifespan)

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next) -> Response:
        response: Response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        if request.url.path in RESET_FRONTEND_PATHS | RESET_PUBLIC_API_PATHS:
            # Public recovery responses are deliberately non-cacheable and may
            # never become a referrer source. The fragment remains client-only,
            # while the endpoint policy prevents response-state leaks too.
            response.headers["Cache-Control"] = "no-store"
            response.headers["Referrer-Policy"] = "no-referrer"
            if request.url.path in RESET_FRONTEND_PATHS:
                response.headers["Content-Security-Policy"] = RESET_CONTENT_SECURITY_POLICY
        else:
            response.headers.setdefault("Referrer-Policy", "same-origin")
        # HSTS is owned by the HTTPS edge.  The ASGI app must not infer trusted
        # transport state from client-controlled forwarding headers.
        return response

    app.add_middleware(CsrfProtectionMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    # Added last so it wraps logging/CSRF/security while remaining inside
    # Starlette's ServerErrorMiddleware.
    app.add_middleware(PublicPasswordResetContainmentMiddleware)
    register_exception_handlers(app)
    app.include_router(auth_router, prefix=API_PREFIX)
    app.include_router(billing_router, prefix=API_PREFIX)
    app.include_router(households_router, prefix=API_PREFIX)
    app.include_router(children_router, prefix=API_PREFIX)
    app.include_router(chores_router, prefix=API_PREFIX)
    app.include_router(homeschool_router, prefix=API_PREFIX)
    app.include_router(modules_router, prefix=API_PREFIX)
    app.include_router(notifications_router, prefix=API_PREFIX)
    app.include_router(recipes_router, prefix=API_PREFIX)
    app.include_router(workflow_router, prefix=API_PREFIX)
    app.include_router(ops_router, prefix="/ops-api")

    @app.get("/health")
    @app.get(f"{API_PREFIX}/health")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/live")
    @app.get(f"{API_PREFIX}/health/live")
    def liveness_healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready")
    @app.get(f"{API_PREFIX}/health/ready")
    def readiness_healthcheck() -> JSONResponse:
        status_code, payload = build_readiness_payload()
        return JSONResponse(status_code=status_code, content=payload)

    _register_frontend_routes(app, frontend_dist_dir or DEFAULT_FRONTEND_DIST_DIR)
    return app


def _register_frontend_routes(app: FastAPI, dist_dir: Path) -> None:
    index_file = dist_dir / "index.html"
    if not index_file.exists():
        return

    @app.get(FRONTEND_BASE_PATH, include_in_schema=False)
    @app.get(f"{FRONTEND_BASE_PATH}/", include_in_schema=False)
    @app.get(f"{FRONTEND_BASE_PATH}/{{frontend_path:path}}", include_in_schema=False)
    def serve_frontend(frontend_path: str = "") -> FileResponse:
        if not frontend_path:
            return FileResponse(index_file)

        candidate = (dist_dir / frontend_path).resolve()
        if dist_dir.resolve() not in candidate.parents or not candidate.is_file():
            return FileResponse(index_file)

        return FileResponse(candidate)


app = create_app()
