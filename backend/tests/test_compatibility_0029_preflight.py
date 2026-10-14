"""Malformed named uniqueness must fail before any compatibility DDL."""
import sqlite3

from alembic import command
import pytest
from sqlalchemy import create_engine, event

from compatibility_0029_helpers import snapshot
from test_legacy_compatibility_0029 import predecessor, PREVIOUS


@pytest.mark.parametrize("fk", [0, 1])
def test_malformed_named_constraint_preflight(monkeypatch, tmp_path, fk):
    path, config = predecessor(monkeypatch, tmp_path, PREVIOUS[1])
    with sqlite3.connect(path) as raw:
        triggers = raw.execute("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY rowid").fetchall()
        indexes = raw.execute("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='users' AND sql IS NOT NULL").fetchall()
        ddl = raw.execute("SELECT sql FROM sqlite_master WHERE name='users'").fetchone()[0]
        for name, _ in triggers:
            raw.execute(f'DROP TRIGGER "{name}"')
        malformed = ddl[:ddl.rfind(")")] + ", CONSTRAINT uq_users_email UNIQUE(id)\n)"
        malformed = malformed.replace('CREATE TABLE "users"', 'CREATE TABLE "synthetic_users"').replace('CREATE TABLE users', 'CREATE TABLE "synthetic_users"')
        raw.execute(malformed)
        raw.execute('INSERT INTO synthetic_users SELECT * FROM users')
        raw.execute('DROP TABLE users')
        raw.execute('ALTER TABLE synthetic_users RENAME TO users')
        for (sql,) in indexes:
            raw.execute(sql)
        for _, sql in triggers:
            raw.execute(sql)
        raw.commit()
        assert raw.execute("PRAGMA foreign_key_check").fetchall() == []
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
        with pytest.raises(RuntimeError, match="0029 malformed uq_users_email"):
            command.upgrade(config, "head")
        assert ddl == []
        assert snapshot(raw) == before
        assert not raw.in_transaction
        assert raw.execute("PRAGMA foreign_keys").fetchone()[0] == fk
    engine.dispose()
