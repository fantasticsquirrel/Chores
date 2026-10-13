"""Retain individual other-name portable history independently of local actors.

Existing entries remain local (NULL); no attribution is fabricated/backfilled.
"""
from alembic import op
import sqlalchemy as sa

revision = '20261013_0026'
down_revision = '20261013_0025'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('family_tree_other_names', sa.Column(
        'portable_provenance', sa.JSON(none_as_null=True), nullable=True))


def downgrade():
    raise RuntimeError('Family Tree rollback is disable-only; preserve genealogy and imported provenance.')
