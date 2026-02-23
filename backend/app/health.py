from __future__ import annotations

from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.db import get_engine


def check_database(database_url: str) -> tuple[bool, str | None]:
    try:
        engine = get_engine(database_url)
        with engine.connect() as connection:
            connection.exec_driver_sql("SELECT 1")
    except SQLAlchemyError:
        return False, "Database unavailable."
    return True, None


def build_readiness_payload() -> tuple[int, dict[str, object]]:
    settings = get_settings()
    database_ok, database_error = check_database(settings.database_url)

    if database_ok:
        return 200, {"status": "ok", "checks": {"database": {"status": "ok"}}}

    return (
        503,
        {
            "status": "degraded",
            "checks": {"database": {"status": "error", "message": database_error}},
        },
    )
