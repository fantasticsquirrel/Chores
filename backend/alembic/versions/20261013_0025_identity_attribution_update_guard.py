"""Keep identity target guards out of attribution-only FK deletion updates.

Replace only the identity UPDATE trigger. Existing table data, INSERT eligibility,
scoped foreign keys, household ownership and revision invalidation are untouched.
"""
from alembic import op

revision = '20261013_0025'
down_revision = '20261013_0024'
branch_labels = None
depends_on = None

IDENTITY_UPDATE_TRIGGER = """CREATE TRIGGER trg_ft_identity_update
BEFORE UPDATE OF user_id, household_id ON family_tree_identity_links
WHEN NEW.user_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM users WHERE id=NEW.user_id AND household_id=NEW.household_id
  AND role IN ('PARENT','PARENT_ADMIN'))
BEGIN SELECT RAISE(ABORT, 'identity target must be an adult'); END"""


def upgrade():
    op.execute('DROP TRIGGER IF EXISTS trg_ft_identity_update')
    op.execute(IDENTITY_UPDATE_TRIGGER)


def downgrade():
    raise RuntimeError('Family Tree rollback is disable-only; preserve history and identity deletion isolation.')
