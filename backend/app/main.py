from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.responses import JSONResponse

from app.api import children_router, workflow_router
from app.config import get_settings
from app.db import initialize_database
from app.error_handling import RequestLoggingMiddleware, register_exception_handlers
from app.health import build_readiness_payload
from app.logging_config import configure_logging
from app.startup import run_startup_checks

API_PREFIX = "/chore-api"
FRONTEND_BASE_PATH = "/chore"
DEFAULT_FRONTEND_DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    run_startup_checks(settings)
    initialize_database(settings)
    yield


def create_app(frontend_dist_dir: Path | None = None) -> FastAPI:
    app = FastAPI(title="Chore Tracker API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(RequestLoggingMiddleware)
    register_exception_handlers(app)
    app.include_router(children_router, prefix=API_PREFIX)
    app.include_router(workflow_router, prefix=API_PREFIX)

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
