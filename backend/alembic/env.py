from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import get_settings
from app.db import Base
from app.models import ALL_MODELS

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url)

_ = ALL_MODELS
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def _run_connection(connection) -> None:
    if connection.dialect.name != "sqlite":
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
        return

    # A real SQLite transaction covers the entire chain, including version DML.
    # Never commit an existing caller transaction just to change FK enforcement.
    raw = connection.connection.driver_connection
    if connection.in_transaction() or raw.in_transaction:
        raise RuntimeError("SQLite migration requires an idle connection")
    prior_fk = raw.execute("PRAGMA foreign_keys").fetchone()[0]
    try:
        raw.execute("PRAGMA foreign_keys=OFF")
        if raw.execute("PRAGMA foreign_keys").fetchone()[0] != 0:
            raise RuntimeError("SQLite migration could not disable foreign keys")
        connection.exec_driver_sql("BEGIN IMMEDIATE")
        if not raw.in_transaction:
            raise RuntimeError("SQLite migration did not establish an actual transaction")
        context.configure(
            connection=connection, target_metadata=target_metadata,
            compare_type=True, transactional_ddl=True,
        )
        with context.begin_transaction():
            context.run_migrations()
        if not raw.in_transaction:
            raise RuntimeError("SQLite migration unexpectedly ended its transaction")
        # Historical sparse fixtures intentionally stop before current head.
        # Verify the compatibility chain after version advancement as well as
        # inside 0029, without retroactively changing those older boundaries.
        if context.get_context().get_current_revision() == "20261014_0029":
            if connection.exec_driver_sql("PRAGMA foreign_key_check").first() is not None:
                raise RuntimeError("SQLite migration foreign key verification failed")
            if connection.exec_driver_sql("PRAGMA integrity_check").scalars().all() != ["ok"]:
                raise RuntimeError("SQLite migration integrity verification failed")
        connection.commit()
    except BaseException:
        connection.rollback()
        raise
    finally:
        if raw.in_transaction:
            connection.rollback()
        raw.execute(f"PRAGMA foreign_keys={prior_fk}")
        if raw.execute("PRAGMA foreign_keys").fetchone()[0] != prior_fk:
            raise RuntimeError("SQLite migration could not restore foreign keys")


def run_migrations_online() -> None:
    supplied = config.attributes.get("connection")
    if supplied is not None:
        _run_connection(supplied)
        return
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.", poolclass=pool.NullPool,
    )
    try:
        with connectable.connect() as connection:
            _run_connection(connection)
    finally:
        connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
