from __future__ import annotations

from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from sqlite3 import Connection as SQLiteConnection
from urllib.parse import urlparse

from sqlalchemy import DateTime, MetaData, create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.config import Settings, SettingsError

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
    cursor.execute("PRAGMA busy_timeout=5000")
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
    _ensure_sqlite_directory(settings.database_url)
    engine = get_engine(settings.database_url)

    if settings.is_production:
        _require_current_alembic_schema(engine)
        return

    from app.models import ALL_MODELS  # Imported lazily so metadata is fully registered.

    _ = ALL_MODELS
    Base.metadata.create_all(bind=engine)
    _install_sqlite_runtime_guards(engine)


def _install_sqlite_runtime_guards(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return
    statements = [

        """CREATE TRIGGER IF NOT EXISTS trg_households_owner_update BEFORE UPDATE OF owner_user_id ON households
        WHEN NEW.owner_user_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM users WHERE id=NEW.owner_user_id AND household_id=NEW.id AND active=1
            AND role IN ('PARENT_ADMIN','PARENT'))
        BEGIN SELECT RAISE(ABORT, 'owner must be an active parent in the same household'); END""",
        """CREATE TRIGGER IF NOT EXISTS trg_users_protect_owner_update BEFORE UPDATE OF household_id, active, role ON users
        WHEN EXISTS (SELECT 1 FROM households WHERE owner_user_id=OLD.id)
          AND (NEW.household_id != OLD.household_id OR NEW.active != 1 OR NEW.role NOT IN ('PARENT_ADMIN','PARENT'))
        BEGIN SELECT RAISE(ABORT, 'current owner cannot be moved, deactivated, or demoted'); END""",
        """CREATE TRIGGER IF NOT EXISTS trg_users_protect_owner_delete BEFORE DELETE ON users
        WHEN EXISTS (SELECT 1 FROM households WHERE owner_user_id=OLD.id)
        BEGIN SELECT RAISE(ABORT, 'current owner cannot be deleted'); END""",
    ]
    for table in ("billing_events", "platform_audit_events", "support_case_notes"):
        statements.extend((
            f"CREATE TRIGGER IF NOT EXISTS trg_{table}_append_only_update BEFORE UPDATE ON {table} BEGIN SELECT RAISE(ABORT, 'append-only record'); END",
            f"CREATE TRIGGER IF NOT EXISTS trg_{table}_append_only_delete BEFORE DELETE ON {table} BEGIN SELECT RAISE(ABORT, 'append-only record'); END",
        ))
    with engine.begin() as connection:
        for statement in statements:
            connection.exec_driver_sql(statement)


def _require_current_alembic_schema(engine: Engine) -> None:
    """Fail closed when production was not migrated through the repository head."""
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    inspector = inspect(engine)
    if "alembic_version" not in inspector.get_table_names():
        raise SettingsError("Production database is not migrated; run alembic upgrade head before startup.")

    with engine.connect() as connection:
        current_revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one_or_none()

    backend_root = Path(__file__).resolve().parents[1]
    config = Config(str(backend_root / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "alembic"))
    expected_revision = ScriptDirectory.from_config(config).get_current_head()
    if current_revision != expected_revision:
        raise SettingsError(
            "Production database schema is not current; run alembic upgrade head before startup "
            f"(current={current_revision or 'none'}, expected={expected_revision})."
        )
