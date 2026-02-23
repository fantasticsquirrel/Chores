from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import children_router
from app.config import get_settings
from app.db import initialize_database
from app.error_handling import RequestLoggingMiddleware, register_exception_handlers
from app.logging_config import configure_logging
from app.startup import run_startup_checks


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    run_startup_checks(settings)
    initialize_database(settings)
    yield


app = FastAPI(title="Chore Tracker API", version="0.1.0", lifespan=lifespan)
app.add_middleware(RequestLoggingMiddleware)
register_exception_handlers(app)
app.include_router(children_router)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
