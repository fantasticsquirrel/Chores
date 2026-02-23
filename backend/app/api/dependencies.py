from __future__ import annotations

from collections.abc import Generator

from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_session_factory


def get_db_session() -> Generator[Session, None, None]:
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        yield session
