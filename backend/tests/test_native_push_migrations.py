"""Forward migration safety and ORM parity, using disposable SQLite only."""
from pathlib import Path

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.db import Base
from app.models import NativePushSubscription

BACKEND = Path(__file__).resolve().parents[1]
PREVIOUS = "20260830_0020"
REVISION = "20261005_0021"
TABLE = "native_push_subscriptions"
MIGRATION = BACKEND / "alembic" / "versions" / "20261005_0021_native_push_subscriptions.py"


@pytest.fixture
def migration_db(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'native-migration.db'}"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("SECRET_KEY", "fixture-migration-secret-key-32-characters")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "alembic"))
    engine = create_engine(url)
    yield config, engine
    engine.dispose()
    get_settings.cache_clear()


def signature(engine):
    inspector = inspect(engine)
    return {
        "columns": sorted((c["name"], str(c["type"]), c["nullable"], c["default"], c["primary_key"])
                          for c in inspector.get_columns(TABLE)),
        "primary_key": inspector.get_pk_constraint(TABLE),
        "unique": sorted((c["name"], tuple(c["column_names"]))
                         for c in inspector.get_unique_constraints(TABLE)),
        "checks": sorted((c["name"], c["sqltext"]) for c in inspector.get_check_constraints(TABLE)),
        "indexes": sorted((i["name"], tuple(i["column_names"]), i["unique"])
                          for i in inspector.get_indexes(TABLE)),
        "foreign_keys": sorted((f["name"], tuple(f["constrained_columns"]), f["referred_table"],
                                tuple(f["referred_columns"]), f["options"].get("ondelete"))
                               for f in inspector.get_foreign_keys(TABLE)),
    }


def test_native_subscription_migration_is_frozen_forward_revision():
    assert MIGRATION.exists(), "Native subscriptions need an explicit forward migration"
    source = MIGRATION.read_text()
    assert f'revision = "{REVISION}"' in source
    assert f'down_revision = "{PREVIOUS}"' in source
    assert "app.models" not in source
    assert "Base.metadata" not in source
    assert "create_all" not in source
    assert "op.create_table(" in source
    assert "INSERT" not in source.upper(), "Migration must not invent device registrations"


def test_fresh_native_subscription_schema_matches_orm(migration_db):
    config, engine = migration_db
    command.upgrade(config, "head")
    assert TABLE in inspect(engine).get_table_names(), "Native table missing at Alembic head"
    oracle = create_engine("sqlite:///:memory:")
    try:
        Base.metadata.create_all(oracle)
        assert signature(engine) == signature(oracle)
        assert len(NativePushSubscription.__table__.columns) == 10
    finally:
        oracle.dispose()


def test_sparse_upgrade_downgrade_reupgrade_preserves_unrelated_rows(migration_db):
    config, engine = migration_db
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE legacy_records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)")
        connection.exec_driver_sql("INSERT INTO legacy_records VALUES (7, 'preserved-browser-record')")
    command.stamp(config, PREVIOUS)
    command.upgrade(config, "head")
    assert TABLE in inspect(engine).get_table_names(), "Sparse SQLite needs the native table too"
    with engine.connect() as connection:
        assert connection.exec_driver_sql(f"SELECT count(*) FROM {TABLE}").scalar_one() == 0
        assert connection.exec_driver_sql("SELECT * FROM legacy_records").all() == [(7, "preserved-browser-record")]
    command.downgrade(config, PREVIOUS)
    assert TABLE not in inspect(engine).get_table_names()
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT * FROM legacy_records").all() == [(7, "preserved-browser-record")]
    command.upgrade(config, "head")
    with engine.connect() as connection:
        assert connection.exec_driver_sql(f"SELECT count(*) FROM {TABLE}").scalar_one() == 0
        assert connection.exec_driver_sql("SELECT * FROM legacy_records").all() == [(7, "preserved-browser-record")]


def seed_sparse_identity(config, engine):
    with engine.begin() as connection:
        for table in ("households", "users", "auth_sessions"):
            connection.exec_driver_sql(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY)")
            connection.exec_driver_sql(f"INSERT INTO {table} VALUES (1)")
    command.stamp(config, PREVIOUS)
    command.upgrade(config, "head")
    assert TABLE in inspect(engine).get_table_names(), "Native migration missing"


def insert_subscription(connection, *, token="ExpoPushToken[fixture-migration]", platform="android", user_id=1):
    connection.exec_driver_sql(
        f"INSERT INTO {TABLE} (user_id, household_id, session_id, token, platform, enabled, last_seen_at, created_at) "
        "VALUES (?, 1, 1, ?, ?, 1, '2026-10-05 00:00:00', '2026-10-05 00:00:00')",
        (user_id, token, platform),
    )


def test_migrated_schema_enforces_token_uniqueness_platform_and_identity(migration_db):
    config, engine = migration_db
    seed_sparse_identity(config, engine)
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        connection.commit()
        with connection.begin():
            insert_subscription(connection)
        for invalid in ({}, {"platform": "web", "token": "fixture-platform"},
                        {"user_id": 999, "token": "fixture-foreign-key"}):
            with pytest.raises(IntegrityError):
                with connection.begin():
                    insert_subscription(connection, **invalid)
        assert connection.exec_driver_sql(f"SELECT count(*) FROM {TABLE}").scalar_one() == 1


@pytest.mark.parametrize("parent", ["users", "households", "auth_sessions"])
def test_migrated_subscription_cascades_on_identity_deletion(migration_db, parent):
    config, engine = migration_db
    seed_sparse_identity(config, engine)
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        connection.commit()
        with connection.begin():
            insert_subscription(connection)
            connection.exec_driver_sql(f"DELETE FROM {parent} WHERE id = 1")
        assert connection.exec_driver_sql(f"SELECT count(*) FROM {TABLE}").scalar_one() == 0
