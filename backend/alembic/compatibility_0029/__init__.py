"""Immutable 0029 preflight and lossless SQLite generalized reconstruction.

SQL surgery changes only the requested declaration, retaining original checks,
FKs, defaults and column order. Unsupported extensions fail before any DDL.
"""
from collections import Counter
import hashlib
import re
import sqlite3

from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import StaticPool

from .legacy import LEGACY_DDL, LEGACY_INDEXES

TARGET_COLUMNS = {
    "users": {"id", "household_id", "email", "password_hash", "role", "child_id", "active", "session_generation", "created_at"},
    "recipes": {"id", "household_id", "owner_user_id", "parent_recipe_id", "title", "description", "photo_url", "source_name", "source_url", "prep_minutes", "cook_minutes", "servings", "yield_quantity", "yield_unit", "rating", "favorite", "notes", "archived_at", "created_at", "updated_at"},
    "recipe_categories": {"id", "household_id", "owner_user_id", "name", "color", "created_at", "updated_at"},
    "recipe_tags": {"id", "household_id", "owner_user_id", "name", "created_at", "updated_at"},
}


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def schema(connection):
    return connection.exec_driver_sql(
        "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY rowid"
    ).all()


def rows(connection, table):
    # Only hashes are retained; neither values nor credentials enter diagnostics.
    return Counter(hashlib.sha256(repr(tuple(row)).encode()).digest()
                   for row in connection.exec_driver_sql(f"SELECT * FROM {quote(table)}"))


def signature(connection, name):
    inspector = inspect(connection)
    columns = [(c["name"], str(c["type"]), c["nullable"], c["default"])
               for c in inspector.get_columns(name)]
    pk = inspector.get_pk_constraint(name)
    checks = sorted((c["name"], re.sub(r"\s+", "", c["sqltext"]))
                    for c in inspector.get_check_constraints(name))
    uniques = sorted((c["name"], tuple(c["column_names"]))
                     for c in inspector.get_unique_constraints(name))
    fks = sorted((c["name"], tuple(c["constrained_columns"]), c["referred_table"],
                  tuple(c["referred_columns"]), tuple(sorted(c["options"].items())))
                 for c in inspector.get_foreign_keys(name))
    indexes = sorted((row[1], row[2], row[4], tuple(connection.exec_driver_sql(
        f"PRAGMA index_xinfo({quote(row[1])})").all()))
        for row in connection.exec_driver_sql(f"PRAGMA index_list({quote(name)})").all())
    return columns, pk, checks, uniques, fks, indexes


def preflight_legacy(connection):
    engine = create_engine("sqlite://", creator=lambda: sqlite3.connect(":memory:"), poolclass=StaticPool)
    try:
        with engine.connect() as reference:
            for name, ddl in LEGACY_DDL.items():
                reference.exec_driver_sql(ddl)
                for sql in LEGACY_INDEXES[name]:
                    reference.exec_driver_sql(sql)
            existing = set(inspect(connection).get_table_names())
            for name in LEGACY_DDL:
                if name in existing and signature(connection, name) != signature(reference, name):
                    raise RuntimeError(f"0029 incompatible retained table: {name}")
            return [name for name in LEGACY_DDL if name not in existing]
    finally:
        engine.dispose()


def preflight(connection):
    raw = connection.connection.driver_connection
    if not raw.in_transaction or raw.execute("PRAGMA foreign_keys").fetchone()[0] != 0:
        raise RuntimeError("0029 requires actual SQLite transaction with foreign keys OFF")
    if connection.exec_driver_sql("PRAGMA foreign_key_check").first() is not None:
        raise RuntimeError("0029 existing foreign key violation")
    if connection.exec_driver_sql("PRAGMA integrity_check").scalars().all() != ["ok"]:
        raise RuntimeError("0029 existing integrity failure")
    missing = preflight_legacy(connection)
    original = schema(connection)
    originals = {name: sql for kind, name, _, sql in original if kind == "table"}
    plans = {}
    for table, expected in TARGET_COLUMNS.items():
        if table not in originals:
            raise RuntimeError(f"0029 missing canonical target: {table}")
        columns = connection.exec_driver_sql(f"PRAGMA table_xinfo({quote(table)})").all()
        if {c[1] for c in columns} != expected or any(c[6] for c in columns):
            raise RuntimeError(f"0029 unsupported target extension: {table}")
        sql = originals[table]
        if re.search(r"\bAUTOINCREMENT\b", sql, re.I):
            raise RuntimeError(f"0029 unsupported AUTOINCREMENT target: {table}")
        if not re.match(r'^CREATE TABLE\s+(?:"' + table + r'"|' + table + r')\s*\(', sql, re.I) or sql[sql.rfind(")") + 1:].strip():
            raise RuntimeError(f"0029 unsupported target declaration: {table}")
        if table != "users":
            if connection.exec_driver_sql(f"SELECT 1 FROM {quote(table)} WHERE updated_at IS NULL LIMIT 1").first():
                raise RuntimeError(f"0029 NULL updated_at: {table}")
            updated = next(c for c in columns if c[1] == "updated_at")
            if not updated[3]:
                pattern = r'([,(]\s*(?:"updated_at"|updated_at)\s+DATETIME)(?=\s*[,\)])'
                sql, count = re.subn(pattern, r'\1 NOT NULL', sql, flags=re.I)
                if count != 1:
                    raise RuntimeError(f"0029 unsupported updated_at declaration: {table}")
                plans[table] = sql
            continue
        inspector = inspect(connection)
        constraints = inspector.get_unique_constraints("users")
        canonical = [c for c in constraints if c["name"] == "uq_users_email"]
        if canonical and (len(canonical) != 1 or canonical[0]["column_names"] != ["email"]):
            raise RuntimeError("0029 malformed uq_users_email")
        if connection.exec_driver_sql("SELECT 1 FROM users WHERE email IS NULL LIMIT 1").first():
            raise RuntimeError("0029 NULL email")
        if connection.exec_driver_sql("SELECT 1 FROM users GROUP BY email HAVING count(*) > 1 LIMIT 1").first():
            raise RuntimeError("0029 duplicate email")
        indexes = connection.exec_driver_sql('PRAGMA index_list("users")').all()
        email_index = [i for i in indexes if i[1] == "ux_users_email"]
        if len(email_index) != 1 or not email_index[0][2] or email_index[0][4]:
            raise RuntimeError("0029 malformed ux_users_email")
        keys = connection.exec_driver_sql('PRAGMA index_xinfo("ux_users_email")').all()
        if [(k[2], k[4]) for k in keys if k[5]] != [("email", "BINARY")]:
            raise RuntimeError("0029 malformed ux_users_email columns/collation")
        if not canonical:
            if "uq_users_email" in sql:
                raise RuntimeError("0029 ambiguous uq_users_email declaration")
            end = sql.rfind(")")
            plans[table] = sql[:end] + ', CONSTRAINT uq_users_email UNIQUE (email)\n' + sql[end:]
    # Reserved objects, virtual tables and extension objects cannot be overwritten.
    names = {obj[1] for obj in original}
    for name in plans:
        if f"_compat_0029_{name}" in names:
            raise RuntimeError("0029 reserved replacement object exists")
    for name in missing:
        if name in names:
            raise RuntimeError("0029 retained table name collision")
        for index_sql in LEGACY_INDEXES[name]:
            index = index_sql.split()[2]
            if index in names:
                raise RuntimeError("0029 retained index name collision")
    return missing, plans, original


def upgrade_sqlite(connection):
    missing, plans, original = preflight(connection)  # No DDL before this returns.
    original_tables = {name: sql for kind, name, _, sql in original if kind == "table"}
    before = {name: rows(connection, name) for name in original_tables if name != "alembic_version"}
    objects = [(kind, name, sql) for kind, name, _, sql in original if kind in {"trigger", "view"}]
    if plans:
        # External triggers/views can block SQLite schema validation during rename.
        for kind, name, _ in reversed(objects):
            connection.exec_driver_sql(f"DROP {kind.upper()} {quote(name)}")
        for table, ddl in plans.items():
            temporary = f"_compat_0029_{table}"
            new_sql = re.sub(r'^(CREATE TABLE\s+)(?:"' + table + r'"|' + table + r')',
                             lambda m: m[1] + quote(temporary), ddl, count=1, flags=re.I)
            connection.exec_driver_sql(new_sql)
            columns = connection.exec_driver_sql(f"PRAGMA table_info({quote(table)})").all()
            fields = ", ".join(quote(column[1]) for column in columns)
            connection.exec_driver_sql(f"INSERT INTO {quote(temporary)} ({fields}) SELECT {fields} FROM {quote(table)}")
            if rows(connection, temporary) != before[table]:
                raise RuntimeError(f"0029 copy verification failed: {table}")
            connection.exec_driver_sql(f"DROP TABLE {quote(table)}")
            connection.exec_driver_sql(f"ALTER TABLE {quote(temporary)} RENAME TO {quote(table)}")
            for kind, _, attached, sql in original:
                if kind == "index" and attached == table:
                    connection.exec_driver_sql(sql)
        for _, _, sql in objects:
            connection.exec_driver_sql(sql)
    for name in missing:
        connection.exec_driver_sql(LEGACY_DDL[name])
        for sql in LEGACY_INDEXES[name]:
            connection.exec_driver_sql(sql)
    after = schema(connection)
    after_objects = {(kind, name): (attached, sql) for kind, name, attached, sql in after}
    for kind, name, attached, sql in original:
        if kind == "table" and name in plans:
            # SQLite adds identifier quotes on rename; everything else is exact.
            expected = re.sub(r'^(CREATE TABLE\s+)(?:"' + name + r'"|' + name + r')',
                              lambda m: m[1] + quote(name), plans[name], count=1, flags=re.I)
            if after_objects.get((kind, name)) != (attached, expected):
                raise RuntimeError(f"0029 reconstructed DDL verification failed: {name}")
        elif after_objects.get((kind, name)) != (attached, sql):
            raise RuntimeError(f"0029 untouched schema verification failed: {name}")
    for name, expected in before.items():
        if rows(connection, name) != expected:
            raise RuntimeError(f"0029 row preservation verification failed: {name}")
    if connection.exec_driver_sql("PRAGMA foreign_key_check").first() is not None:
        raise RuntimeError("0029 foreign key verification failed")
    if connection.exec_driver_sql("PRAGMA integrity_check").scalars().all() != ["ok"]:
        raise RuntimeError("0029 integrity verification failed")
