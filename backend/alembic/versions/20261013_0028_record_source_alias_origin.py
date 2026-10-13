"""Recover provably local names erased by 0027's record-source fallback.

ImportSourceKey is also a retained RECORD provenance container. It does not by
itself prove that its person was append-imported. This narrowly repairs complete
surviving record-bearing merge components, using actual mutation operation and
scoped affected-person semantics. No source-key convention, quoted person
metadata, actor identity, or timestamp tolerance establishes origin.

First classify every original row and retained copy; imported/copy evidence wins
before any local restoration. A native person.create receipt proves native
person origin; an import receipt proves append origin and bounds its original
names. Exact immutable fingerprints on surviving merge aliases locate retained
copies, including duplicates. Only native original rows and strictly later
append-person original rows in a complete merge component are recoverable.
Gap-free household graph audit revisions additionally bind each original insert
to its actual local create/patch operation; absent merge receipts are never
interpreted as proof that a merge did not occur.

0027's unknown payload is indistinguishable from explicit portable unknown in
isolation. Never promote it merely because it postdates an import: a complete
producer/copy classification is required. Missing source/receipt/person or
unaccounted incoming-merge evidence leaves unknown untouched. Purged evidence,
manually rewritten operational fields, or non-producer data cannot be exactly
reconstructed. Existing quoted histories/private local markers are untouched.
No operational column, account association, table, index, or public DTO changes.
"""
from collections import defaultdict
from datetime import UTC
import json

from alembic import op
import sqlalchemy as sa

revision = '20261013_0028'
down_revision = '20261013_0027'
branch_labels = None
depends_on = None

UNKNOWN = {'status': 'unknown', 'source_label': None, 'created_at': None, 'attribution': None}
LOCAL = {'origin': 'local'}


def instant(value):
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def upgrade():
    bind = op.get_bind()
    # Frozen reflection, not mutable live application metadata.
    metadata = sa.MetaData()
    tables = {name: sa.Table('family_tree_' + name, metadata, autoload_with=bind)
              for name in ['other_names', 'people', 'import_source_keys', 'mutation_receipts']}
    names = tables['other_names']
    rows = list(bind.execute(sa.select(names)).mappings())

    def person_key(row, pid=None):
        return (row['household_id'], row['collection_id'], row['person_id'] if pid is None else pid)

    def fingerprint(row):
        return (row['name'], row['label'], row['created_by_user_id'], instant(row['created_at']))

    people = {person_key(r, r['id']): r for r in bind.execute(sa.select(tables['people'])).mappings()}
    sources = {person_key(r): r for r in bind.execute(sa.select(tables['import_source_keys'])).mappings()}
    by_person = defaultdict(list)
    for row in rows:
        by_person[person_key(row)].append(row)
    imports, natives, merges = defaultdict(list), defaultdict(list), defaultdict(list)
    for receipt in bind.execute(sa.select(tables['mutation_receipts'])).mappings():
        affected = (receipt['result'] or {}).get('affected', {}).get('person_ids', [])
        operation = receipt['operation']
        if operation.startswith('import:'):
            for pid in affected:
                imports[person_key(receipt, pid)].append(instant(receipt['created_at']))
        elif operation == 'person.create' and len(affected) == 1:
            natives[person_key(receipt, affected[0])].append(instant(receipt['created_at']))
        elif operation == 'merge' and len(affected) >= 2:
            merges[person_key(receipt, affected[1])].append(
                (person_key(receipt, affected[0]), instant(receipt['created_at'])))

    audit = sa.Table('security_audit_events', metadata, autoload_with=bind)
    collections = sa.Table('family_tree_collections', metadata, autoload_with=bind)
    revisions = {r['household_id']: r['revision'] for r in bind.execute(sa.select(collections)).mappings()}
    events = defaultdict(list)
    for event in bind.execute(sa.select(audit).where(audit.c.event_type.like('family_tree.%'))).mappings():
        details = json.loads(event['details_json'])
        if details.get('outcome') == 'committed' and isinstance(details.get('revision'), int):
            events[event['household_id']].append((details['revision'], instant(event['created_at']),
                event['event_type'], details.get('affected', {}).get('person_ids', [])))
    complete_audit = {}
    for household, history in events.items():
        history.sort()
        # Gap-free operational revision coverage makes missing/purged incoming
        # merges detectable; merely finding no merge receipt is NOT evidence.
        if [e[0] for e in history] == list(range(1, revisions.get(household, 0) + 1)):
            if all(a[1] < b[1] for a, b in zip(history, history[1:])):
                complete_audit[household] = history

    def locally_inserted(row):
        # Household graph writes are serialized. Default-created originals fall
        # in the committing local create/patch interval; merge copies preserve
        # an earlier timestamp and are separately excluded by origin inventory.
        at = instant(row['created_at'])
        for _, end, kind, affected in complete_audit.get(row['household_id'], []):
            if end >= at:
                return kind in {'family_tree.person.create', 'family_tree.person.patch'} and affected == [row['person_id']]
        return False

    # This slice intentionally excludes chained/retargeted merges, where a lost
    # earlier receipt can conceal a portable copy's true origin.
    incoming = defaultdict(set)
    for key, person in people.items():
        if person['merged_into_person_id'] is not None:
            incoming[(*key[:2], person['merged_into_person_id'])].add(key)
    restore = set()
    for target_key, target_source in sources.items():
        target = people.get(target_key)
        if target is None or imports[target_key] or not natives[target_key]:
            continue
        if target['merged_into_person_id'] is not None or not target_source['provenance'].get('records'):
            continue
        target_time = instant(target_source['created_at'])
        if not any(instant(target['created_at']) <= end < target_time for end in natives[target_key]):
            continue
        history = complete_audit.get(target_key[0])
        if not history:
            continue
        audited_merges = [affected for _, _, kind, affected in history
                          if kind == 'family_tree.merge' and len(affected) >= 2 and affected[1] == target_key[2]]
        edges = merges[target_key]
        participants = incoming[target_key]
        if any(len(affected) != 2 for affected in audited_merges):
            continue
        if {(*target_key[:2], affected[0]) for affected in audited_merges} != participants:
            continue
        # Missing/purged participants, a receipt-less merge, or a retargeted
        # alias means the copy inventory is incomplete: do not guess.
        if not participants or {key for key, _ in edges} != participants:
            continue
        if not any(end >= target_time for _, end in edges):
            continue
        fences = {}
        complete = True
        for key in participants:
            source = sources.get(key)
            was_merge_target = any(kind == 'family_tree.merge' and len(affected) >= 2 and affected[1] == key[2]
                                   for _, _, kind, affected in history)
            if source is None or incoming[key] or merges[key] or natives[key] or was_merge_target:
                complete = False
                break
            ends = [end for end in imports[key] if end >= instant(source['created_at'])]
            if len(ends) != 1:
                complete = False
                break
            fences[key] = ends[0]
        if not complete:
            continue

        imported_fingerprints = set()
        local_fingerprints = set()
        copied_fingerprints = set()
        for key, fence in fences.items():
            for row in by_person[key]:
                signature = fingerprint(row)
                copied_fingerprints.add(signature)
                history = row['portable_provenance']
                # Explicit quoted histories never become local. Operational
                # insert time, not quoted portable created_at, bounds append.
                if instant(row['created_at']) <= fence or history not in (None, UNKNOWN, LOCAL):
                    imported_fingerprints.add(signature)
                elif locally_inserted(row):
                    local_fingerprints.add(signature)
                else:
                    imported_fingerprints.add(signature)
        # Imported origin has priority even if a fingerprint collision exists.
        local_fingerprints -= imported_fingerprints
        for key in [target_key, *participants]:
            for row in by_person[key]:
                if row['portable_provenance'] != UNKNOWN:
                    continue
                signature = fingerprint(row)
                if signature in imported_fingerprints:
                    continue
                if signature in local_fingerprints:
                    restore.add(row['id'])
                elif key == target_key and signature not in copied_fingerprints and locally_inserted(row):
                    # Native target original, not a quoted/unknown copied entry.
                    # Every incoming merge source survives and is classified.
                    restore.add(row['id'])
    for rid in sorted(restore):
        bind.execute(names.update().where(names.c.id == rid).values(portable_provenance=LOCAL))


def downgrade():
    raise RuntimeError('Family Tree rollback is disable-only; preserve genealogy and imported provenance.')
