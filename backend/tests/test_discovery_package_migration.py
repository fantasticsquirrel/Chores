"""Package rollout is additive; downgrade never destroys authored content."""

from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from app.config import get_settings


def test_package_downgrade_retains_versions_and_revokes_execution(
    tmp_path, monkeypatch
):
    database_url = f"sqlite:///{tmp_path}/packages.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(config, "head")
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO households (id,name,timezone,owner_user_id,created_at) VALUES (1,'Home','UTC',1,CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO users (id,household_id,email,password_hash,role,active,created_at) VALUES (1,1,'owner@test.com','unused','PARENT_ADMIN',1,CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO children (id,household_id,name,active,created_at) VALUES (1,1,'Kid',1,CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO discovery_packages VALUES (1,'authored','1.0.0',CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO discovery_package_versions VALUES (1,'authored','1.0.0','worker-v1',:checksum,'{}',CURRENT_TIMESTAMP)"
            ),
            {"checksum": "a" * 64},
        )
        connection.execute(
            text(
                "INSERT INTO discovery_package_grants VALUES (1,1,'authored','1.0.0',1,CURRENT_TIMESTAMP)"
            )
        )
    command.downgrade(config, "20261024_0030")
    command.upgrade(config, "head")
    command.check(config)
    with engine.connect() as connection:
        assert (
            connection.execute(
                text("SELECT COUNT(*) FROM discovery_package_versions")
            ).scalar_one()
            == 1
        )
        assert (
            connection.execute(
                text("SELECT published_version FROM discovery_packages")
            ).scalar_one()
            is None
        )
        assert (
            connection.execute(
                text("SELECT enabled FROM discovery_package_grants")
            ).scalar_one()
            == 0
        )
        assert connection.execute(text("PRAGMA foreign_key_check")).all() == []
    engine.dispose()
