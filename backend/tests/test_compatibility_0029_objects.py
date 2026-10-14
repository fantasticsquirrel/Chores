"""Lossless unknown objects, exact create_all contract and idle boundaries."""
import sqlite3

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
import pytest
from sqlalchemy import create_engine, inspect

from app.db import Base
from compatibility_0029_fixture import LEGACY_DDL, LEGACY_INDEXES
from compatibility_0029_helpers import snapshot
from test_legacy_compatibility_0029 import configuration, predecessor, PREVIOUS


@pytest.mark.parametrize("revision", PREVIOUS)
@pytest.mark.parametrize("fk", [0, 1])
def test_unknown_table_indexes_trigger_and_dependent_view_retained(monkeypatch, tmp_path, revision, fk):
    path, config = predecessor(monkeypatch, tmp_path, revision)
    with sqlite3.connect(path) as raw:
        raw.execute("CREATE TABLE unknown_history(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,payload BLOB NOT NULL)")
        raw.execute("INSERT INTO unknown_history VALUES(31,3,X'0001FF')")
        raw.execute("CREATE INDEX unknown_history_actor ON unknown_history(user_id)")
        raw.execute("CREATE INDEX unknown_users_suffix ON users(email) WHERE active=1")
        raw.execute("CREATE VIEW unknown_user_view AS SELECT h.id,u.email FROM unknown_history h JOIN users u ON u.id=h.user_id")
        raw.execute("CREATE TRIGGER unknown_history_guard BEFORE UPDATE ON unknown_history WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id) BEGIN SELECT RAISE(ABORT,'unknown actor'); END")
        raw.commit()
        before = snapshot(raw)
    engine = create_engine(f"sqlite:///{path}")
    with engine.connect() as connection:
        raw = connection.connection.driver_connection
        raw.execute(f"PRAGMA foreign_keys={fk}")
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
        after = snapshot(raw)
        exact = {(kind, name): (attached, sql) for kind, name, attached, sql in after[0]}
        for kind, name, attached, sql in before[0]:
            if name.startswith("unknown_"):
                assert exact[(kind, name)] == (attached, sql)
        assert after[1]["unknown_history"] == before[1]["unknown_history"]
        assert raw.execute("SELECT count(*) FROM unknown_user_view").fetchone()[0] == 1
        assert raw.execute("PRAGMA foreign_keys").fetchone()[0] == fk
        # Unknown schemas are deliberately visible in the UNFILTERED comparison.
        diffs = compare_metadata(MigrationContext.configure(connection), Base.metadata)
        assert sorted(diff[0] for diff in diffs) == ["remove_index", "remove_index", "remove_table"]
        assert {diff[1].name for diff in diffs} == {"unknown_history_actor", "unknown_users_suffix", "unknown_history"}
        with pytest.raises(sqlite3.IntegrityError, match="unknown actor"):
            raw.execute("UPDATE unknown_history SET user_id=999 WHERE id=31")
        raw.rollback()
    engine.dispose()


def test_create_all_exact_legacy_schema_against_independent_ddl(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'create-all.sqlite'}")
    Base.metadata.create_all(engine)
    with engine.connect() as connection, sqlite3.connect(":memory:") as golden:
        assert set(inspect(connection).get_table_names()) == set(Base.metadata.tables)
        assert len(inspect(connection).get_table_names()) == 75
        assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
        raw = connection.connection.driver_connection
        for name, ddl in LEGACY_DDL.items():
            golden.execute(ddl)
            for sql in LEGACY_INDEXES[name]:
                golden.execute(sql)
            assert list(raw.execute(f'PRAGMA table_info("{name}")')) == list(golden.execute(f'PRAGMA table_info("{name}")'))
            assert sorted(raw.execute(f'PRAGMA foreign_key_list("{name}")')) == sorted(golden.execute(f'PRAGMA foreign_key_list("{name}")'))
            assert sorted((r[1], r[2], r[3], r[4]) for r in raw.execute(f'PRAGMA index_list("{name}")')) == sorted((r[1], r[2], r[3], r[4]) for r in golden.execute(f'PRAGMA index_list("{name}")'))
            for index in golden.execute(f'PRAGMA index_list("{name}")').fetchall():
                assert list(raw.execute(f'PRAGMA index_xinfo("{index[1]}")')) == list(golden.execute(f'PRAGMA index_xinfo("{index[1]}")'))
            assert raw.execute(f'SELECT * FROM "{name}"').fetchall() == []
    engine.dispose()


@pytest.mark.parametrize("fk", [0, 1])
def test_existing_transaction_rejected_without_implicit_commit(monkeypatch, tmp_path, fk):
    path, config = predecessor(monkeypatch, tmp_path, PREVIOUS[0])
    engine = create_engine(f"sqlite:///{path}")
    with engine.connect() as connection:
        raw = connection.connection.driver_connection
        raw.execute(f"PRAGMA foreign_keys={fk}")
        before = snapshot(raw)
        connection.exec_driver_sql("BEGIN IMMEDIATE")
        connection.exec_driver_sql("UPDATE recipes SET title='uncommitted caller' WHERE id=8")
        config.attributes["connection"] = connection
        with pytest.raises(RuntimeError, match="requires an idle connection"):
            command.upgrade(config, "head")
        assert raw.in_transaction
        assert raw.execute("PRAGMA foreign_keys").fetchone()[0] == fk
        connection.rollback()
        assert snapshot(raw) == before
    engine.dispose()
