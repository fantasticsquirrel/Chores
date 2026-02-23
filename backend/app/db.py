from __future__ import annotations

from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from sqlite3 import Connection as SQLiteConnection
from urllib.parse import urlparse

from sqlalchemy import DateTime, MetaData, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.config import Settings

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


def _apply_sqlite_pragmas(dbapi_connection: object, _: object) -> None:
    if not isinstance(dbapi_connection, SQLiteConnection):
        return

    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


@lru_cache(maxsize=1)
def get_engine(database_url: str) -> Engine:
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    engine = create_engine(database_url, future=True, connect_args=connect_args)

    if database_url.startswith("sqlite"):
        event.listen(engine, "connect", _apply_sqlite_pragmas)

    return engine


@lru_cache(maxsize=1)
def get_session_factory(database_url: str) -> sessionmaker:
    return sessionmaker(bind=get_engine(database_url), autoflush=False, autocommit=False, expire_on_commit=False)


def _ensure_sqlite_directory(database_url: str) -> None:
    if not database_url.startswith("sqlite"):
        return

    parsed = urlparse(database_url)
    raw_path = parsed.path
    if database_url.startswith("sqlite:///./"):
        raw_path = database_url.replace("sqlite:///", "", 1)

    db_path = Path(raw_path).expanduser().resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)


def initialize_database(settings: Settings) -> None:
    from app.models import ALL_MODELS  # Imported lazily so metadata is fully registered.

    _ = ALL_MODELS
    _ensure_sqlite_directory(settings.database_url)
    Base.metadata.create_all(bind=get_engine(settings.database_url))
