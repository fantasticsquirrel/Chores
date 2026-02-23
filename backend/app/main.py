from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.db import initialize_database
from app.startup import run_startup_checks


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    run_startup_checks(settings)
    initialize_database(settings)
    yield


app = FastAPI(title="Chore Tracker API", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
