from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
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
