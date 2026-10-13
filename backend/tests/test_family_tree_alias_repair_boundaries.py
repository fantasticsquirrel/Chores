"""Boundaries of frozen 0027 data repair (real SQL, no history guesses)."""
from datetime import datetime
import importlib.util
from pathlib import Path

from sqlalchemy import Column, DateTime, Integer, JSON, MetaData, String, Table, create_engine, select


def test_forward_repair_scoped_copies_ties_and_explicit_histories(tmp_path, monkeypatch):
    path = Path(__file__).resolve().parents[1] / 'alembic/versions/20261013_0027_legacy_alias_history.py'
    spec = importlib.util.spec_from_file_location('frozen_alias_repair', path)
    assert spec is not None and spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    metadata = MetaData()
    names = Table('family_tree_other_names', metadata,
        Column('id', Integer, primary_key=True), Column('household_id', Integer),
        Column('collection_id', Integer), Column('person_id', Integer),
        Column('name', String), Column('label', String), Column('created_by_user_id', Integer),
        Column('created_at', DateTime), Column('portable_provenance', JSON(none_as_null=True)))
    sources = Table('family_tree_import_source_keys', metadata,
        Column('household_id', Integer), Column('collection_id', Integer),
        Column('person_id', Integer), Column('source_key', String), Column('created_at', DateTime))
    receipts = Table('family_tree_mutation_receipts', metadata,
        Column('household_id', Integer), Column('collection_id', Integer),
        Column('operation', String), Column('result', JSON), Column('created_at', DateTime))
    people = Table('family_tree_people', metadata,
        Column('id', Integer), Column('household_id', Integer),
        Column('collection_id', Integer), Column('merged_into_person_id', Integer))
    engine = create_engine(f'sqlite:///{tmp_path / "boundary.sqlite"}')
    metadata.create_all(engine)
    early, end, later = [datetime(2020, 1, day) for day in [1, 2, 3]]
    quoted = {'status': 'known', 'created_at': ' Ancient entered text ', 'attribution': ' Original recorder '}
    with engine.begin() as c:
        for pid in [1, 2, 3]:
            c.execute(people.insert().values(id=pid, household_id=1, collection_id=1, merged_into_person_id=2 if pid == 1 else None))
        c.execute(sources.insert(), [dict(household_id=1, collection_id=1, person_id=1, source_key='p:1', created_at=early),
                                     dict(household_id=1, collection_id=1, person_id=3, source_key='merge:caller-controlled', created_at=later)])
        c.execute(receipts.insert().values(household_id=1, collection_id=1, operation='import:1',
            result={'affected': {'person_ids': [1]}}, created_at=end))
        values = [
            (1, 1, 1, 'Imported', early, None),
            (2, 1, 1, 'Tie is uncertain', end, None),
            (3, 1, 1, 'Later local', later, None),
            (4, 1, 2, 'Imported', early, None),  # retained merge copy
            (5, 1, 2, 'Later local', later, None),
            (6, 1, 1, 'Quoted', early, quoted),
            (7, 1, 3, 'Missing receipt', later, None),
            (8, 1, 3, 'Durably local', early, {'origin': 'local'}),
            (9, 2, 2, 'Imported', early, None),  # cross-tenant non-copy
            (10, 1, 2, 'Genuine prior local', early, None),  # not a copied imported name
        ]
        for rid, household, pid, name, at, history in values:
            c.execute(names.insert().values(id=rid, household_id=household, collection_id=household,
                person_id=pid, name=name, label='Duplicate citation', created_by_user_id=None,
                created_at=at, portable_provenance=history))
        before = c.execute(select(names).order_by(names.c.id)).all()
        monkeypatch.setattr(migration.op, 'get_bind', lambda: c)
        migration.upgrade()
        after = c.execute(select(names).order_by(names.c.id)).all()
        assert [tuple(r)[:-1] for r in after] == [tuple(r)[:-1] for r in before]
        repaired = {r.id for r in after if r.portable_provenance == {
            'status': 'unknown', 'source_label': None, 'created_at': None, 'attribution': None}}
        assert repaired == {1, 2, 4, 7}
        by_id = {r.id: r.portable_provenance for r in after}
        assert by_id[6] == quoted and by_id[8] == {'origin': 'local'}
        assert all(by_id[rid] is None for rid in [3, 5, 9, 10])
        migration.upgrade()
        assert c.execute(select(names).order_by(names.c.id)).all() == after
    engine.dispose()
