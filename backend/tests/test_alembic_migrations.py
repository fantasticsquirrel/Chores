from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, inspect, text

from app.config import get_settings
from app.db import Base, get_engine, get_session_factory
from app.models import ALL_MODELS


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"

CRITICAL_CHECK_CONSTRAINTS = {
    "users": {"ck_users_user_role_child_link"},
    "chores": {
        "ck_chores_reward_non_negative",
        "ck_chores_positive_schedule_interval",
        "ck_chores_positive_timeout_days",
    },
    "recipes": {
        "ck_recipes_recipe_prep_minutes_non_negative",
        "ck_recipes_recipe_cook_minutes_non_negative",
        "ck_recipes_recipe_servings_positive",
        "ck_recipes_recipe_yield_quantity_positive",
        "ck_recipes_recipe_rating_range",
    },
    "recipe_feedback": {
        "ck_recipe_feedback_recipe_feedback_rating_range",
        "ck_recipe_feedback_recipe_feedback_reviewer_type",
        "ck_recipe_feedback_recipe_feedback_reviewer_target",
    },
}
CRITICAL_UNIQUE_CONSTRAINTS = {
    "users": {"uq_users_household_id", "uq_users_email"},
    "tags": {"uq_tags_household_id"},
    "chore_rotation_members": {"uq_chore_rotation_members_chore_id"},
    "completion_records": {"uq_completion_records_child_id"},
    "homeschool_attendance": {"uq_homeschool_attendance_child_subject_date"},
    "notifications": {"uq_notifications_user_dedup_key"},
    "push_subscriptions": {"uq_push_subscriptions_user_endpoint"},
}
CRITICAL_INDEXES = {
    "children": {"ix_children_household_id"},
    "users": {"ix_users_household_id", "ix_users_child_id", "ux_users_email"},
    "chores": {"ix_chores_household_id"},
    "submissions": {"ix_submissions_household_id", "ix_submissions_child_id", "ix_submissions_for_date"},
    "completion_records": {
        "ix_completion_records_household_id",
        "ix_completion_records_child_id",
        "ix_completion_records_chore_id",
    },
    "transactions": {"ix_transactions_household_id", "ix_transactions_child_id"},
    "recipes": {"ix_recipes_household_id", "ix_recipes_owner_user_id", "ix_recipes_title"},
    "notifications": {"ix_notifications_household_id", "ix_notifications_user_id", "ix_notifications_read_at"},
}


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
    _ = ALL_MODELS
    assert set(inspector.get_table_names()) - {"alembic_version"} == set(Base.metadata.tables)

    for table_name, expected_names in CRITICAL_CHECK_CONSTRAINTS.items():
        actual_names = {constraint["name"] for constraint in inspector.get_check_constraints(table_name)}
        assert expected_names <= actual_names, table_name

    for table_name, expected_names in CRITICAL_UNIQUE_CONSTRAINTS.items():
        actual_names = {constraint["name"] for constraint in inspector.get_unique_constraints(table_name)}
        assert expected_names <= actual_names, table_name

    for table_name, expected_names in CRITICAL_INDEXES.items():
        actual_names = {index["name"] for index in inspector.get_indexes(table_name)}
        assert expected_names <= actual_names, table_name


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

    # Sparse legacy databases must support rollback and re-application of the
    # security migration even when optional historical chore tables are absent.
    command.downgrade(alembic_config, "20260714_0012")
    downgraded = inspect(create_engine(database_url))
    assert "auth_sessions" not in downgraded.get_table_names()
    assert "active" not in {column["name"] for column in downgraded.get_columns("users")}

    command.upgrade(alembic_config, "head")
    upgraded = inspect(create_engine(database_url))
    assert "auth_sessions" in upgraded.get_table_names()
    assert "active" in {column["name"] for column in upgraded.get_columns("users")}


def test_recipe_timestamp_compatibility_migration_repairs_runtime_created_schema(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Legacy create_all recipe tables omitted columns present in migration 0007."""
    database_path = tmp_path / "legacy-recipes.db"
    database_url = f"sqlite:///{database_path}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-with-at-least-32-characters")
    get_settings.cache_clear()

    engine = create_engine(database_url)
    with engine.begin() as connection:
        for table in ("recipe_categories", "recipe_tags", "recipes"):
            connection.exec_driver_sql(
                f"CREATE TABLE {table} (id INTEGER PRIMARY KEY, created_at DATETIME NOT NULL)"
            )
            connection.exec_driver_sql(
                f"INSERT INTO {table} (id, created_at) VALUES (1, '2026-01-02 03:04:05')"
            )
    engine.dispose()

    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    alembic_config.set_main_option("sqlalchemy.url", database_url)
    command.stamp(alembic_config, "20260714_0013")
    command.upgrade(alembic_config, "head")

    engine = create_engine(database_url)
    with engine.connect() as connection:
        inspector = inspect(connection)
        for table in ("recipe_categories", "recipe_tags", "recipes"):
            assert "updated_at" in {column["name"] for column in inspector.get_columns(table)}
            assert connection.exec_driver_sql(
                f"SELECT updated_at FROM {table} WHERE id = 1"
            ).scalar_one() == "2026-01-02 03:04:05"


def test_notification_queue_migration_preserves_successful_delivery_history(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    database_url = f"sqlite:///{tmp_path / 'notification-dedup.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-with-at-least-32-characters")
    get_settings.cache_clear()

    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    alembic_config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(alembic_config, "20260618_0011")

    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """INSERT INTO notifications
            (id, household_id, user_id, child_id, module_key, category, severity, title, body,
             link_url, read_at, expires_at, dedup_key, created_at)
            VALUES (1, 1, 1, NULL, 'chores', 'approval', 'info', 'Title', 'Body',
                    '/chore/', NULL, NULL, NULL, '2026-01-01 00:00:00')"""
        )
        connection.exec_driver_sql(
            """INSERT INTO notification_delivery_attempts
            (id, notification_id, channel, status, attempted_at, error_message)
            VALUES
              (1, 1, 'push:1', 'failed', '2026-01-01 00:00:00', 'temporary'),
              (2, 1, 'push:1', 'delivered', '2026-01-01 00:01:00', '')"""
        )
    engine.dispose()

    command.upgrade(alembic_config, "20260714_0012")

    engine = create_engine(database_url)
    with engine.connect() as connection:
        rows = connection.exec_driver_sql(
            "SELECT id, status FROM notification_delivery_attempts ORDER BY id"
        ).all()
    assert rows == [(2, "delivered")]


def test_security_migration_reserves_occurrence_keys_only_for_approved_records(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    database_url = f"sqlite:///{tmp_path / 'completion-status.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-with-at-least-32-characters")
    get_settings.cache_clear()

    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE users (id INTEGER PRIMARY KEY)")
        connection.exec_driver_sql("CREATE TABLE chores (id INTEGER PRIMARY KEY, completion_mode VARCHAR(32) NOT NULL)")
        connection.exec_driver_sql(
            """CREATE TABLE completion_records (
            id INTEGER PRIMARY KEY, household_id INTEGER NOT NULL, child_id INTEGER NOT NULL,
            chore_id INTEGER NOT NULL, date DATE NOT NULL, status VARCHAR(32) NOT NULL)"""
        )
        connection.exec_driver_sql("INSERT INTO users (id) VALUES (1)")
        connection.exec_driver_sql("INSERT INTO chores (id, completion_mode) VALUES (1, 'SHARED')")
        connection.exec_driver_sql(
            """INSERT INTO completion_records
            (id, household_id, child_id, chore_id, date, status) VALUES
            (1, 1, 10, 1, '2026-01-02', 'REJECTED'),
            (2, 1, 11, 1, '2026-01-02', 'APPROVED')"""
        )
    engine.dispose()

    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    alembic_config.set_main_option("sqlalchemy.url", database_url)
    command.stamp(alembic_config, "20260714_0012")
    command.upgrade(alembic_config, "20260714_0013")

    engine = create_engine(database_url)
    with engine.connect() as connection:
        rows = connection.exec_driver_sql(
            "SELECT id, occurrence_key FROM completion_records ORDER BY id"
        ).all()
    assert rows == [(1, None), (2, "household:1:chore:1:date:2026-01-02")]


def test_forward_migration_quarantines_legacy_unsent_delivery_attempts(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    database_url = f"sqlite:///{tmp_path / 'legacy-notification-queue.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-with-at-least-32-characters")
    get_settings.cache_clear()

    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    alembic_config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(alembic_config, "20260715_0014")

    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """INSERT INTO notifications
            (id, household_id, user_id, child_id, module_key, category, severity, title, body,
             link_url, read_at, expires_at, dedup_key, created_at, in_app_visible)
            VALUES (1, 1, 1, NULL, 'chores', 'approval', 'info', 'Title', 'Body',
                    '/chore/', NULL, NULL, NULL, '2026-01-01 00:00:00', 1)"""
        )
        connection.exec_driver_sql(
            """INSERT INTO notification_delivery_attempts
            (id, notification_id, channel, status, attempted_at, error_message)
            VALUES
              (1, 1, 'push:1', 'pending', '2026-01-01 00:00:00', ''),
              (2, 1, 'push:2', 'sent', '2026-01-01 00:01:00', '')"""
        )
    engine.dispose()

    command.upgrade(alembic_config, "head")

    engine = create_engine(database_url)
    with engine.connect() as connection:
        rows = connection.exec_driver_sql(
            "SELECT id, status, error_message FROM notification_delivery_attempts ORDER BY id"
        ).all()
    assert rows == [
        (1, "dead", "legacy-dedup-audit-required"),
        (2, "sent", ""),
    ]


def _phase9_alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def test_phase9_upgrade_backfills_lowest_active_admin_and_preserves_household(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    database_url = f"sqlite:///{tmp_path / 'phase9-existing.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    config = _phase9_alembic_config(database_url)
    command.upgrade(config, "20260715_0015")
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.exec_driver_sql("INSERT INTO households (id,name,timezone,created_at) VALUES (1,'Preserved','UTC','2026-01-01')")
        connection.exec_driver_sql("INSERT INTO users (id,household_id,email,password_hash,role,child_id,active,created_at) VALUES (9,1,'parent@test','x','PARENT',NULL,1,'2026-01-01'),(4,1,'admin@test','x','PARENT_ADMIN',NULL,1,'2026-01-01'),(2,1,'inactive@test','x','PARENT_ADMIN',NULL,0,'2026-01-01')")
    command.upgrade(config, "head")
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT name, owner_user_id FROM households WHERE id=1").one() == ("Preserved", 4)
        assert {"platform_users", "platform_sessions", "billing_accounts", "billing_events", "household_entitlements", "support_cases", "support_case_notes", "platform_audit_events"} <= set(inspect(connection).get_table_names())


def test_phase9_upgrade_fails_clearly_for_ownerless_household(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    database_url = f"sqlite:///{tmp_path / 'phase9-ownerless.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    config = _phase9_alembic_config(database_url)
    command.upgrade(config, "20260715_0015")
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.exec_driver_sql("INSERT INTO households (id,name,timezone,created_at) VALUES (1,'No Parent','UTC','2026-01-01')")
    with pytest.raises(Exception, match="no active parent eligible for ownership"):
        command.upgrade(config, "head")


def test_phase9_schema_enforces_owner_and_provider_identity_contracts(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    database_url = f"sqlite:///{tmp_path / 'phase9-contracts.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    config = _phase9_alembic_config(database_url)
    command.upgrade(config, "20260715_0015")
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.exec_driver_sql("INSERT INTO households (id,name,timezone,created_at) VALUES (1,'Owned','UTC','2026-01-01')")
        connection.exec_driver_sql("INSERT INTO users (id,household_id,email,password_hash,role,child_id,active,created_at) VALUES (4,1,'admin@test','x','PARENT_ADMIN',NULL,1,'2026-01-01')")
    command.upgrade(config, "head")
    inspector = inspect(engine)
    owner_column = next(column for column in inspector.get_columns("households") if column["name"] == "owner_user_id")
    role_column = next(column for column in inspector.get_columns("platform_users") if column["name"] == "role")
    assert owner_column["nullable"] is False
    assert role_column["type"].length >= len("PLATFORM_SUPPORT")
    assert "billing_customer_references" in inspector.get_table_names()
    assert {"provider", "provider_subscription_id"} <= {column["name"] for column in inspector.get_columns("subscriptions")}
    with engine.begin() as connection:
        with pytest.raises(Exception, match="owner"):
            connection.exec_driver_sql("UPDATE households SET owner_user_id=NULL WHERE id=1")


def test_phase9_upgrade_rejects_sparse_schema_instead_of_stamping_head(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    database_url = f"sqlite:///{tmp_path / 'phase9-sparse.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    config = _phase9_alembic_config(database_url)
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
        connection.exec_driver_sql("INSERT INTO alembic_version VALUES ('20260715_0015')")
        connection.exec_driver_sql("CREATE TABLE households (id INTEGER PRIMARY KEY, name VARCHAR(255), timezone VARCHAR(64), created_at DATETIME)")
    with pytest.raises(Exception, match="requires core tables.*users"):
        command.upgrade(config, "head")
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == "20260715_0015"
