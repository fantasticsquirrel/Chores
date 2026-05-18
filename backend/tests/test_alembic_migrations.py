from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

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
