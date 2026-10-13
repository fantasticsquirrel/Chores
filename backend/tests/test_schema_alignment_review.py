"""Unfiltered drift and preexisting-schema preservation, not FT-only checks."""
from pathlib import Path
import pytest
from alembic import command
from alembic.config import Config
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text
from app.config import get_settings
from app.db import Base, get_engine
from app.models import ALL_MODELS


def cfg():
    root=Path(__file__).resolve().parents[1]
    c=Config(str(root/'alembic.ini')); c.set_main_option('script_location',str(root/'alembic'))
    return c


@pytest.mark.parametrize('previous',[False,True])
def test_unfiltered_migration_parity_and_existing_rows(tmp_path,monkeypatch,previous):
    url=f'sqlite:///{tmp_path / "schema.sqlite"}'
    monkeypatch.setenv('APP_ENV','test'); monkeypatch.setenv('DATABASE_URL',url)
    get_settings.cache_clear()
    if previous:
        command.upgrade(cfg(),'20261013_0023')
        with get_engine(url).begin() as c:
            c.execute(text("INSERT INTO households(id,name,timezone,owner_user_id,created_at) VALUES (901,'Preserved','UTC',902,CURRENT_TIMESTAMP)"))
            c.execute(text("INSERT INTO users(id,household_id,email,password_hash,role,active,created_at) VALUES (902,901,'preserved@example.test','unused','PARENT_ADMIN',1,CURRENT_TIMESTAMP)"))
            c.execute(text("INSERT INTO family_tree_collections(id,household_id,title,revision,created_at,updated_at) VALUES (903,901,'Preserved tree',7,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
            c.execute(text("INSERT INTO family_tree_people(id,collection_id,household_id,facts,search_text,is_locked,created_by_user_id,created_at,updated_at) VALUES (904,903,901,'{\"display_name\":\"Preserved\",\"living_status\":\"unknown\"}','preserved',0,902,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
        with get_engine(url).connect() as c:
            before={row[0]:row[1] for row in c.execute(text("SELECT name,sql FROM sqlite_master WHERE type='table'"))}
            rows={t:list(c.execute(text(f'SELECT * FROM "{t}"')).tuples()) for t in before if t!='alembic_version'}
    command.upgrade(cfg(),'head')
    command.check(cfg())
    with get_engine(url).connect() as c:
        assert compare_metadata(MigrationContext.configure(c),Base.metadata)==[]
        assert inspect(c).get_columns('households')[3]['nullable'] is False
        assert c.execute(text('PRAGMA foreign_key_check')).all()==[]
        if previous:
            after={row[0]:row[1] for row in c.execute(text("SELECT name,sql FROM sqlite_master WHERE type='table'"))}
            assert before==after
            for t,expected in rows.items(): assert list(c.execute(text(f'SELECT * FROM "{t}"')).tuples())==expected, t
            c.execute(text('DELETE FROM users WHERE id=902')) if False else None
