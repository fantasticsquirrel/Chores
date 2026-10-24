"""Forward-only alias history migrations: populated 25→27 and fresh parity."""
from pathlib import Path
import json

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text


def config():
    root = Path(__file__).resolve().parents[1]
    cfg = Config(str(root / 'alembic.ini'))
    cfg.set_main_option('script_location', str(root / 'alembic'))
    return cfg


def snapshot(connection):
    tables = connection.execute(text("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).all()
    return {name: (sql, connection.execute(text(f'SELECT * FROM "{name}" ORDER BY rowid')).all())
            for name, sql in tables if name != 'alembic_version'}


@pytest.mark.parametrize('populated', [False, True])
def test_alias_history_migration_preserves_existing_rows_and_unfiltered_schema(tmp_path, monkeypatch, populated):
    from app.config import get_settings
    from app.models import ALL_MODELS, Household, User
    url = f'sqlite:///{tmp_path / "migration.sqlite"}'
    monkeypatch.setenv('APP_ENV', 'test')
    monkeypatch.setenv('DATABASE_URL', url)
    monkeypatch.setenv('SECRET_KEY', 'a' * 32)
    get_settings.cache_clear()
    cfg = config()
    engine = create_engine(url)
    before = None
    if populated:
        command.upgrade(cfg, '20261013_0025')
        with engine.begin() as c:
            # Raw predecessor SQL never depends on live alias ORM columns.
            c.execute(text('PRAGMA foreign_keys=ON'))
            c.execute(text('PRAGMA defer_foreign_keys=ON'))
            c.execute(Household.__table__.insert().values(id=501, name='Sentinel', owner_user_id=601))
            c.execute(User.__table__.insert().values(id=601, household_id=501, email='sentinel@example.test', role='PARENT_ADMIN', password_hash='unused', active=True))
            c.execute(text("INSERT INTO family_tree_collections (id,household_id,title,revision,created_by_user_id,created_at,updated_at) VALUES (701,501,'Preserved',3,601,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
            c.execute(text("INSERT INTO family_tree_people (id,household_id,collection_id,facts,search_text,is_locked,created_by_user_id,created_at,updated_at) VALUES (801,501,701,:facts,'sentinel',0,601,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"), {'facts': json.dumps({'display_name': 'Sentinel', 'aliases': [{'name': 'Original'}]})})
            c.execute(text("INSERT INTO family_tree_other_names (id,household_id,collection_id,person_id,name,label,position,created_by_user_id,created_at,updated_at) VALUES (901,501,701,801,'Original','Citation',0,601,'2001-02-03 04:05:06','2001-02-03 04:05:06')"))
            before = snapshot(c)
    command.upgrade(cfg, '20261013_0028')
    with engine.connect() as c:
        assert c.execute(text('SELECT version_num FROM alembic_version')).scalar_one() == '20261013_0028'
        assert not c.execute(text('PRAGMA foreign_key_check')).all()
        if before is not None:
            after = snapshot(c)
            assert before.keys() == after.keys()
            for table, (ddl, rows) in before.items():
                if table == 'family_tree_other_names':
                    assert after[table][1] == [tuple(row) + (None,) for row in rows]
                    assert 'portable_provenance JSON' in after[table][0]
                else:
                    assert after[table] == (ddl, rows), table
    # Keep the exact original alias/disable-only boundary pinned to 0028.
    with pytest.raises(RuntimeError, match='disable-only'):
        command.downgrade(cfg, '20261013_0025')
    with engine.connect() as c:
        assert c.execute(text('SELECT version_num FROM alembic_version')).scalar_one() == '20261013_0028'
        previous_head = snapshot(c)
    command.upgrade(cfg, 'head')
    with engine.connect() as c:
        from app.models import RETAINED_HOMESCHOOL_TABLES
        after_head = snapshot(c)
        assert set(after_head) == set(previous_head) | {table.name for table in RETAINED_HOMESCHOOL_TABLES} | {"discovery_exploration_access", "discovery_packages", "discovery_package_versions", "discovery_package_grants"}
        for name, old in previous_head.items():
            if name in {"modules", "household_module_access"}:
                assert after_head[name][0] == old[0], name
                assert all(row in after_head[name][1] for row in old[1]), name
                added = [row for row in after_head[name][1] if row not in old[1]]
                assert all("discovery-lab" in row for row in added), name
            else:
                assert after_head[name] == old, name
        for table in RETAINED_HOMESCHOOL_TABLES:
            assert after_head[table.name][1] == []
        assert c.execute(text('SELECT version_num FROM alembic_version')).scalar_one() == '20261024_0031'
    command.check(cfg)
    engine.dispose()
