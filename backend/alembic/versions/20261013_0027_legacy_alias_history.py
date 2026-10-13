"""Conservatively repair identifiable predecessor-imported alias history.

0025 discarded alias origin and erased committed manifests. Source keys survive,
while import receipts (affected person IDs + post-action insertion timestamp) are
TTL/actor-owned. Name defaults can run AFTER Source defaults in the same flush:
Source.created_at is NOT an import-end fence. No tolerance/age threshold is used.

A surviving import receipt naming the source person permits a strict post-import
fence. Null aliases after that fence are later entries, not original append rows.
Identifiable retained imported copies are repaired by exact operational fingerprint
independently of the target's fence (merge copies retain their original time).
Missing evidence makes null aliases on imported/merged people uncertain, never
asserted original history. Unrelated later imports do not erase local evidence.
We do not alter operational fields, explicit S2 histories, or account associations.

Boundary: expired/deleted receipts may make real later local entries uncertain.
Already-purged source/merge evidence cannot reconstruct unidentifiable copies or
previously exported false claims. This is not exact historical reconstruction.
Future ordinary entries carry a private local marker, independent of receipts.
"""
from collections import defaultdict
from datetime import UTC

from alembic import op
import sqlalchemy as sa

revision = '20261013_0027'
down_revision = '20261013_0026'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    names = sa.table('family_tree_other_names',
        sa.column('id', sa.Integer), sa.column('household_id', sa.Integer),
        sa.column('collection_id', sa.Integer), sa.column('person_id', sa.Integer),
        sa.column('name', sa.String), sa.column('label', sa.String),
        sa.column('created_by_user_id', sa.Integer), sa.column('created_at', sa.DateTime),
        sa.column('portable_provenance', sa.JSON(none_as_null=True)))
    sources = sa.table('family_tree_import_source_keys',
        sa.column('household_id', sa.Integer), sa.column('collection_id', sa.Integer),
        sa.column('person_id', sa.Integer), sa.column('source_key', sa.String),
        sa.column('created_at', sa.DateTime))
    receipts = sa.table('family_tree_mutation_receipts',
        sa.column('household_id', sa.Integer), sa.column('collection_id', sa.Integer),
        sa.column('operation', sa.String), sa.column('result', sa.JSON),
        sa.column('created_at', sa.DateTime))

    def instant(value):
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

    import_ends = defaultdict(list)
    for row in bind.execute(sa.select(receipts).where(receipts.c.operation.like('import:%'))).mappings():
        for pid in row['result']['affected']['person_ids']:
            import_ends[(row['household_id'], row['collection_id'], pid)].append(instant(row['created_at']))
    groups = defaultdict(list)
    for row in bind.execute(sa.select(sources)).mappings():
        groups[(row['household_id'], row['collection_id'])].append(row)
    rows = list(bind.execute(sa.select(names)).mappings())
    by_person = defaultdict(list)
    for row in rows:
        by_person[(row['household_id'], row['collection_id'], row['person_id'])].append(row)
    unknown = {'status': 'unknown', 'source_label': None, 'created_at': None, 'attribution': None}
    repair = set()

    def fingerprint(row):
        return (row['household_id'], row['collection_id'], row['name'], row['label'],
                row['created_by_user_id'], instant(row['created_at']))

    for scope, imported in groups.items():
        for source in imported:
            # Unmatched merge-generated sources are ambiguous too; never infer
            # origin from a caller-controlled source_key prefix.
            matching = [end for end in import_ends[(*scope, source['person_id'])]
                        if end >= instant(source['created_at'])]
            fence = max(matching) if matching else None
            # A merge target can already have genuine local names before this
            # import. Only original source rows enter this fence; retained
            # copies are matched independently below, never by target age.
            for row in by_person[(*scope, source['person_id'])]:
                if row['portable_provenance'] is None and (fence is None or instant(row['created_at']) <= fence):
                    repair.add(row['id'])
    fingerprints = {fingerprint(row) for row in rows if row['id'] in repair}
    for row in rows:
        if row['portable_provenance'] is None and fingerprint(row) in fingerprints:
            repair.add(row['id'])
    for rid in sorted(repair):
        bind.execute(names.update().where(names.c.id == rid).values(portable_provenance=unknown))


def downgrade():
    raise RuntimeError('Family Tree rollback is disable-only; preserve genealogy and imported provenance.')
