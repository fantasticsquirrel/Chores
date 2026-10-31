"""Compatibility-only 0029: exact parity and atomic SQLite reconstruction."""
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from app.config import get_settings
from app.db import Base
from app.models import ALL_MODELS

ROOT = Path(__file__).resolve().parents[1]
HEAD = "20261031_0032"
LEGACY = {"homeschool_courses", "homeschool_lessons",
          "homeschool_course_assignments", "homeschool_lesson_progress"}


def configuration(monkeypatch, path):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{path}")
    get_settings.cache_clear()
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "alembic"))
    return config


def test_fresh_exact_retained_inventory_and_unfiltered_parity(monkeypatch, tmp_path):
    config = configuration(monkeypatch, tmp_path / "fresh.sqlite")
    command.upgrade(config, "head")
    assert len(Base.metadata.tables) == 79
    assert LEGACY <= set(Base.metadata.tables)
    assert len(ALL_MODELS) == 75  # Retention is Table-only, not a revived API.
    engine = create_engine(f"sqlite:///{tmp_path / 'fresh.sqlite'}")
    with engine.connect() as connection:
        assert set(inspect(connection).get_table_names()) == set(Base.metadata.tables) | {"alembic_version"}
        assert connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == HEAD
        assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
    command.check(config)
    engine.dispose()


import sqlite3
import pytest
from sqlalchemy import event
from sqlalchemy.exc import IntegrityError
from compatibility_0029_helpers import historicize, snapshot
from compatibility_0029_fixture import LEGACY_DDL
from app.db import _require_current_alembic_schema


PREVIOUS = ["20261005_0021", "20261013_0028"]


def predecessor(monkeypatch, tmp_path, revision):
    path = tmp_path / "predecessor.sqlite"
    config = configuration(monkeypatch, path)
    command.upgrade(config, revision)
    historicize(path)
    return path, config


@pytest.mark.parametrize("revision", PREVIOUS)
@pytest.mark.parametrize("fk", [0, 1])
def test_populated_full_chain_preserves_every_row_and_schema(monkeypatch, tmp_path, revision, fk):
    path, config = predecessor(monkeypatch, tmp_path, revision)
    with sqlite3.connect(path) as raw:
        before_schema, before_rows = snapshot(raw)
    engine = create_engine(f"sqlite:///{path}")
    with engine.connect() as connection:
        raw = connection.connection.driver_connection
        raw.execute(f"PRAGMA foreign_keys={fk}")
        config.attributes["connection"] = connection
        states = []
        def actual_transaction(conn, cursor, statement, params, context, many):
            if statement.lstrip().upper().startswith(("CREATE", "DROP", "ALTER", "INSERT", "UPDATE", "DELETE")):
                states.append((raw.in_transaction, raw.execute("PRAGMA foreign_keys").fetchone()[0]))
        event.listen(connection, "before_cursor_execute", actual_transaction)
        command.upgrade(config, "head")
        event.remove(connection, "before_cursor_execute", actual_transaction)
        assert states and set(states) == {(True, 0)}
        assert not raw.in_transaction
        assert raw.execute("PRAGMA foreign_keys").fetchone()[0] == fk
        after_schema, after_rows = snapshot(raw)
        additions = {}
        for table, old in before_rows.items():
            if table == "alembic_version":
                continue
            assert not (old - after_rows[table]), table
            added = sum((after_rows[table] - old).values())
            if added:
                additions[table] = added
        assert additions == ({"modules": 2, "household_module_access": 2} if revision == PREVIOUS[0] else {"modules": 1, "household_module_access": 1})
        changed = {"users", "recipes", "recipe_categories", "recipe_tags"}
        after = {(kind, name): (attached, sql) for kind, name, attached, sql in after_schema}
        for kind, name, attached, sql in before_schema:
            if kind == "table" and name in changed:
                continue
            assert after[(kind, name)] == (attached, sql), name
        for table in LEGACY:
            assert after[("table", table)][1] == LEGACY_DDL[table]
        assert raw.execute("PRAGMA foreign_key_check").fetchall() == []
        assert raw.execute("PRAGMA integrity_check").fetchall() == [("ok",)]
        command.check(config)
        assert raw.execute("PRAGMA foreign_keys").fetchone()[0] == fk
    _require_current_alembic_schema(engine)
    # Guard behavior is exercised, not inferred from trigger names.
    with engine.connect() as connection:
        with pytest.raises(IntegrityError, match="current owner cannot"):
            connection.exec_driver_sql("DELETE FROM users WHERE id=2")
        connection.rollback()
        with pytest.raises(IntegrityError, match="current owner cannot"):
            connection.exec_driver_sql("UPDATE users SET active=0 WHERE id=2")
        connection.rollback()
        with pytest.raises(IntegrityError, match="owner must"):
            connection.exec_driver_sql("UPDATE households SET owner_user_id=4 WHERE id=1")
        connection.rollback()
        with pytest.raises(IntegrityError, match="append-only"):
            connection.exec_driver_sql("UPDATE platform_audit_events SET event_type='changed' WHERE id=16")
        connection.rollback()
        if revision == PREVIOUS[1]:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.exec_driver_sql("DELETE FROM users WHERE id=3")
            assert connection.exec_driver_sql("SELECT count(*) FROM family_tree_identity_links").scalar_one() == 0
            assert connection.exec_driver_sql("SELECT created_by_user_id FROM family_tree_people WHERE id=18").scalar_one() is None
            assert connection.exec_driver_sql("SELECT revision FROM family_tree_collections WHERE id=17").scalar_one() == 10
            connection.rollback()
    engine.dispose()


FAULTS = {
    "copy": lambda sql, params: sql.startswith('INSERT INTO "_compat_0029_users"'),
    "drop": lambda sql, params: sql == 'DROP TABLE "users"',
    "rename": lambda sql, params: sql.startswith('ALTER TABLE "_compat_0029_users"'),
    "index": lambda sql, params: sql.startswith("CREATE UNIQUE INDEX ux_users_email"),
    "trigger": lambda sql, params: sql.startswith("CREATE TRIGGER trg_households_owner_update"),
    "revision": lambda sql, params: sql.startswith("UPDATE alembic_version") and HEAD in sql + str(params),
}


@pytest.mark.parametrize("revision", PREVIOUS)
@pytest.mark.parametrize("fk", [0, 1])
@pytest.mark.parametrize("phase", list(FAULTS))
def test_real_fault_atomic_rollback_including_version(monkeypatch, tmp_path, revision, fk, phase):
    path, config = predecessor(monkeypatch, tmp_path, revision)
    engine = create_engine(f"sqlite:///{path}")
    with engine.connect() as connection:
        raw = connection.connection.driver_connection
        raw.execute(f"PRAGMA foreign_keys={fk}")
        before = snapshot(raw)
        config.attributes["connection"] = connection
        injected = []
        def fail(conn, cursor, statement, params, context, many):
            if FAULTS[phase](statement, params):
                injected.append((raw.in_transaction, raw.execute("PRAGMA foreign_keys").fetchone()[0]))
                raise RuntimeError("synthetic injected failure")
        event.listen(connection, "after_cursor_execute", fail)
        with pytest.raises(RuntimeError, match="synthetic injected failure"):
            command.upgrade(config, "head")
        event.remove(connection, "after_cursor_execute", fail)
        assert injected == [(True, 0)]
        assert not raw.in_transaction
        assert raw.execute("PRAGMA foreign_keys").fetchone()[0] == fk
        assert snapshot(raw) == before
        assert not raw.execute("SELECT name FROM sqlite_master WHERE name LIKE '_compat_0029_%'").fetchall()
        assert raw.execute("PRAGMA foreign_key_check").fetchall() == []
    engine.dispose()


@pytest.mark.parametrize("bad", ["null-recipes", "null-recipe_categories", "null-recipe_tags", "extension", "malformed", "duplicate", "legacy"])
@pytest.mark.parametrize("fk", [0, 1])
def test_preflight_rejects_before_any_ddl(monkeypatch, tmp_path, bad, fk):
    path, config = predecessor(monkeypatch, tmp_path, PREVIOUS[1])
    with sqlite3.connect(path) as raw:
        if bad.startswith("null-"):
            raw.execute(f'UPDATE "{bad[5:]}" SET updated_at=NULL')
        elif bad == "extension":
            raw.execute("ALTER TABLE users ADD COLUMN extension TEXT")
        elif bad == "malformed":
            raw.execute("DROP INDEX ux_users_email")
            raw.execute("CREATE INDEX ux_users_email ON users(email)")
        elif bad == "duplicate":
            raw.execute("DROP INDEX ux_users_email")
            raw.execute("INSERT INTO households(id,name,timezone,owner_user_id,created_at) VALUES(20,'Duplicate fixture','UTC',21,'2026-01-01')")
            raw.execute("INSERT INTO users(id,household_id,email,password_hash,role,active,created_at) VALUES(21,20,'owner@example.test','unused','PARENT_ADMIN',1,'2026-01-01')")
            raw.execute("CREATE INDEX ux_users_email ON users(email)")
            assert raw.execute("PRAGMA foreign_key_check").fetchall() == []
        else:
            raw.execute("ALTER TABLE homeschool_lessons ADD COLUMN extension_unknown TEXT")
        raw.commit()
        before = snapshot(raw)
    engine = create_engine(f"sqlite:///{path}")
    with engine.connect() as connection:
        raw = connection.connection.driver_connection
        raw.execute(f"PRAGMA foreign_keys={fk}")
        config.attributes["connection"] = connection
        ddl = []
        def record(conn, cursor, statement, params, context, many):
            if statement.lstrip().upper().startswith(("CREATE", "DROP", "ALTER")):
                ddl.append(statement)
        event.listen(connection, "before_cursor_execute", record)
        expected_error = "0029 duplicate email" if bad == "duplicate" else "0029"
        with pytest.raises(RuntimeError, match=expected_error):
            command.upgrade(config, "head")
        assert ddl == []
        assert snapshot(raw) == before
        assert raw.execute("PRAGMA foreign_keys").fetchone()[0] == fk
    engine.dispose()


def test_normalized_predecessor_does_not_rebuild(monkeypatch, tmp_path):
    path = tmp_path / "normalized.sqlite"
    config = configuration(monkeypatch, path)
    command.upgrade(config, PREVIOUS[1])
    with sqlite3.connect(path) as raw:
        before = snapshot(raw)
    command.upgrade(config, "20261014_0029")
    with sqlite3.connect(path) as raw:
        after = snapshot(raw)
        expected_schema = sorted(before[0] + [("table", name, name, ddl) for name, ddl in LEGACY_DDL.items()]
                                + [("index", sql.split()[2], name, sql) for name, stmts in __import__('compatibility_0029_fixture').LEGACY_INDEXES.items() for sql in stmts], key=lambda row: (row[0], row[1]))
        assert after[0] == expected_schema
        for table, rows in before[1].items():
            if table != "alembic_version":
                assert after[1][table] == rows
    command.upgrade(config, "head")
    command.check(config)
