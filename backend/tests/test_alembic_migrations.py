from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.config import get_settings
from app.db import get_engine, get_session_factory


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"


def test_alembic_upgrade_head_creates_family_manager_schema(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "alembic_head.db"
    database_url = f"sqlite:///{db_file}"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()

    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    alembic_config.set_main_option("sqlalchemy.url", database_url)

    command.upgrade(alembic_config, "head")

    inspector = inspect(create_engine(database_url))
    table_names = set(inspector.get_table_names())
    assert {
        "modules",
        "household_module_access",
        "user_module_access",
        "homeschool_semesters",
        "homeschool_subjects",
        "homeschool_attendance",
        "homeschool_day_comments",
        "homeschool_grades",
    }.issubset(table_names)


def test_global_user_email_migration_renames_duplicate_emails(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "duplicate_email_migration.db"
    database_url = f"sqlite:///{db_file}"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()

    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(text("INSERT INTO alembic_version (version_num) VALUES ('20260518_0004')"))
        connection.execute(
            text(
                """
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY,
                    household_id INTEGER NOT NULL,
                    email VARCHAR(320) NOT NULL,
                    password_hash VARCHAR(512) NOT NULL,
                    role VARCHAR(32) NOT NULL,
                    child_id INTEGER NULL,
                    created_at DATETIME,
                    updated_at DATETIME,
                    UNIQUE (household_id, email)
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO users (id, household_id, email, password_hash, role, child_id)
                VALUES
                    (1, 10, 'shared@example.com', 'hash', 'CHILD', 100),
                    (2, 11, 'shared@example.com', 'hash', 'CHILD', 200)
                """
            )
        )

    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    alembic_config.set_main_option("sqlalchemy.url", database_url)

    command.upgrade(alembic_config, "head")

    with engine.connect() as connection:
        rows = connection.execute(text("SELECT id, email FROM users ORDER BY id")).all()
        duplicate_count = connection.execute(
            text("SELECT count(*) FROM (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1)")
        ).scalar_one()

    assert rows == [(1, "shared@example.com"), (2, "duplicate-user-2@child.local")]
    assert duplicate_count == 0
