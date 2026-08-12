from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.db import get_engine, get_session_factory
from app.models.core import Household, PasswordReset, PasswordResetDelivery, PasswordResetRequest, User
from app.models.enums import UserRole


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"


def _alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def test_password_reset_migration_creates_secret_free_tables(tmp_path: Path, monkeypatch) -> None:
    database_url = f"sqlite:///{tmp_path / 'password-reset.db'}"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    config = _alembic_config(database_url)

    command.upgrade(config, "head")

    inspector = inspect(create_engine(database_url))
    assert {"password_resets", "password_reset_requests", "password_reset_deliveries"} <= set(
        inspector.get_table_names()
    )

    reset_columns = {column["name"] for column in inspector.get_columns("password_resets")}
    assert {
        "id",
        "user_id",
        "token_key_version",
        "token_digest",
        "expires_at",
        "consumed_at",
        "invalidated_at",
        "created_at",
    } <= reset_columns

    delivery_columns = {column["name"] for column in inspector.get_columns("password_reset_deliveries")}
    assert {
        "password_reset_id",
        "kind",
        "status",
        "attempt_count",
        "available_at",
        "lease_expires_at",
        "accepted_by_mta_at",
        "terminal_at",
        "last_error_code",
        "created_at",
    } <= delivery_columns
    reset_constraints = {constraint["name"] for constraint in inspector.get_check_constraints("password_resets")}
    assert {
        "ck_password_resets_password_reset_token_key_version_nonempty",
        "ck_password_resets_password_reset_token_digest_length",
    } <= reset_constraints
    reset_indexes = {index["name"] for index in inspector.get_indexes("password_resets")}
    assert {
        "ix_password_resets_user_id",
        "ix_password_resets_expires_at",
        "ix_password_resets_consumed_at",
        "ix_password_resets_invalidated_at",
        "uq_password_resets_one_active_user",
    } <= reset_indexes

    request_constraints = {constraint["name"] for constraint in inspector.get_check_constraints("password_reset_requests")}
    assert {
        "ck_password_reset_requests_password_reset_request_email_key_hash_length",
        "ck_password_reset_requests_password_reset_request_ip_key_hash_length",
    } <= request_constraints
    request_indexes = {index["name"] for index in inspector.get_indexes("password_reset_requests")}
    assert {
        "ix_password_reset_requests_user_id",
        "ix_password_reset_requests_household_id",
        "ix_password_reset_requests_email_created",
        "ix_password_reset_requests_ip_created",
        "ix_password_reset_requests_household_created",
    } <= request_indexes

    delivery_constraints = {constraint["name"] for constraint in inspector.get_check_constraints("password_reset_deliveries")}
    assert {
        "ck_password_reset_deliveries_password_reset_delivery_kind",
        "ck_password_reset_deliveries_password_reset_delivery_status",
        "ck_password_reset_deliveries_password_reset_delivery_attempt_count_nonnegative",
    } <= delivery_constraints
    delivery_indexes = {index["name"] for index in inspector.get_indexes("password_reset_deliveries")}
    assert {
        "ix_password_reset_deliveries_password_reset_id",
        "ix_password_reset_deliveries_status_available",
        "ix_password_reset_deliveries_lease_expires_at",
    } <= delivery_indexes


def _upgrade_password_reset_database(tmp_path: Path, monkeypatch) -> tuple[str, Config]:
    database_url = f"sqlite:///{tmp_path / 'password-reset-orm.db'}"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    config = _alembic_config(database_url)
    command.upgrade(config, "head")
    return database_url, config


def _create_parent(session) -> User:
    # The production schema uses a deferrable owner FK and requires the owner
    # at insert time. Explicit IDs let both sides be added in one transaction.
    household = Household(id=1001, name="Reset Home", timezone="UTC", owner_user_id=2001)
    parent = User(
        id=2001,
        household_id=household.id,
        email="parent@example.com",
        password_hash="hash",
        role=UserRole.PARENT,
        child_id=None,
    )
    session.add_all((household, parent))
    session.flush()
    return parent


def test_password_reset_models_enforce_active_capability_and_secret_free_cascade(tmp_path: Path, monkeypatch) -> None:
    database_url, _config = _upgrade_password_reset_database(tmp_path, monkeypatch)
    factory = get_session_factory(database_url)
    now = datetime.now(UTC)

    with factory() as session:
        parent = _create_parent(session)
        first = PasswordReset(
            user_id=parent.id,
            token_key_version="v1",
            token_digest="a" * 64,
            expires_at=now + timedelta(minutes=15),
        )
        session.add(first)
        session.flush()
        delivery = PasswordResetDelivery(
            password_reset_id=first.id,
            kind="reset_link",
            available_at=now,
        )
        request = PasswordResetRequest(
            user_id=parent.id,
            household_id=parent.household_id,
            email_key_hash="b" * 64,
            ip_key_hash="c" * 64,
            outcome="issued",
        )
        session.add_all((delivery, request))
        session.commit()
        first_id = first.id
        parent_id = parent.id

    with factory() as session:
        session.add(
            PasswordReset(
                user_id=parent_id,
                token_key_version="v1",
                token_digest="d" * 64,
                expires_at=now + timedelta(minutes=15),
            )
        )
        with pytest.raises(IntegrityError):
            session.flush()
        session.rollback()

        first = session.get(PasswordReset, first_id)
        assert first is not None
        first.consumed_at = now
        session.commit()

    with factory() as session:
        next_reset = PasswordReset(
            user_id=parent_id,
            token_key_version="v1",
            token_digest="d" * 64,
            expires_at=now + timedelta(minutes=15),
        )
        session.add(next_reset)
        session.commit()
        next_reset_id = next_reset.id
        session.delete(next_reset)
        session.commit()
        assert session.scalar(
            select(PasswordResetDelivery).where(PasswordResetDelivery.password_reset_id == next_reset_id)
        ) is None


def test_password_reset_migration_round_trip_and_sparse_identity_fixture(tmp_path: Path, monkeypatch) -> None:
    database_url, config = _upgrade_password_reset_database(tmp_path, monkeypatch)
    command.downgrade(config, "20260719_0016")
    downgraded = inspect(create_engine(database_url))
    assert "password_resets" not in downgraded.get_table_names()
    command.upgrade(config, "head")
    upgraded = inspect(create_engine(database_url))
    assert {"password_resets", "password_reset_requests", "password_reset_deliveries"} <= set(upgraded.get_table_names())

    sparse_url = f"sqlite:///{tmp_path / 'sparse-reset.db'}"
    sparse_config = _alembic_config(sparse_url)
    sparse_engine = create_engine(sparse_url)
    with sparse_engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
        connection.exec_driver_sql("INSERT INTO alembic_version (version_num) VALUES ('20260719_0016')")
    command.upgrade(sparse_config, "head")
    assert "password_resets" not in inspect(sparse_engine).get_table_names()
