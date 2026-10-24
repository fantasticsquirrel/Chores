from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from app.config import get_settings


def test_discovery_migration_opt_in_and_preserves_preferences(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path}/discovery-migration.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(config, "20261014_0029")
    engine = create_engine(database_url)
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO households (id,name,timezone,owner_user_id,created_at) VALUES (1,'Existing','UTC',1,CURRENT_TIMESTAMP)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO users (id,household_id,email,password_hash,role,active,created_at) VALUES (1,1,'owner@example.test','unused','PARENT_ADMIN',1,CURRENT_TIMESTAMP)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO children (id,household_id,name,active,created_at) VALUES (1,1,'Kid',1,CURRENT_TIMESTAMP)"
            )
        )
    command.upgrade(config, "head")
    with engine.begin() as conn:
        assert (
            conn.execute(
                text("SELECT enabled FROM modules WHERE key='discovery-lab'")
            ).scalar_one()
            == 1
        )
        assert (
            conn.execute(
                text(
                    "SELECT enabled FROM household_module_access WHERE household_id=1 AND module_key='discovery-lab'"
                )
            ).scalar_one()
            == 0
        )
        conn.execute(
            text(
                "INSERT INTO discovery_exploration_access VALUES (1,1,'gravity',0,CURRENT_TIMESTAMP)"
            )
        )
    command.check(config)
    command.downgrade(config, "20261014_0029")
    with engine.connect() as conn:
        assert (
            conn.execute(
                text("SELECT enabled FROM modules WHERE key='discovery-lab'")
            ).scalar_one()
            == 0
        )
        assert (
            conn.execute(
                text(
                    "SELECT enabled FROM discovery_exploration_access WHERE exploration_id='gravity'"
                )
            ).scalar_one()
            == 0
        )
    command.upgrade(config, "head")
    with engine.connect() as conn:
        # A repeated upgrade never erases preferences or silently re-enables a disabled catalog.
        assert (
            conn.execute(
                text("SELECT enabled FROM modules WHERE key='discovery-lab'")
            ).scalar_one()
            == 0
        )
        assert (
            conn.execute(
                text(
                    "SELECT enabled FROM discovery_exploration_access WHERE exploration_id='gravity'"
                )
            ).scalar_one()
            == 0
        )
        assert conn.execute(text("PRAGMA foreign_key_check")).all() == []
    engine.dispose()
