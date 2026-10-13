"""Invalidate user attribution across the full tree; add missing legacy indexes.

Production tables, columns and constraints are unchanged. Migration is frozen
and deliberately does not import application metadata.
"""
from alembic import op

revision = '20261013_0024'
down_revision = '20261013_0023'
branch_labels = None
depends_on = None

USER_DELETE_TRIGGER = 'CREATE TRIGGER trg_ft_users_delete BEFORE DELETE ON users BEGIN UPDATE family_tree_collections SET revision=revision+1, updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT id FROM family_tree_collections WHERE created_by_user_id=OLD.id UNION SELECT collection_id FROM family_tree_people WHERE created_by_user_id=OLD.id OR locked_by_user_id=OLD.id UNION SELECT collection_id FROM family_tree_person_tags WHERE created_by_user_id=OLD.id UNION SELECT collection_id FROM family_tree_other_names WHERE created_by_user_id=OLD.id UNION SELECT collection_id FROM family_tree_parent_links WHERE created_by_user_id=OLD.id UNION SELECT collection_id FROM family_tree_care_links WHERE created_by_user_id=OLD.id UNION SELECT collection_id FROM family_tree_partner_episodes WHERE created_by_user_id=OLD.id UNION SELECT collection_id FROM family_tree_stories WHERE created_by_user_id=OLD.id UNION SELECT collection_id FROM family_tree_residences WHERE created_by_user_id=OLD.id UNION SELECT collection_id FROM family_tree_identity_links WHERE created_by_user_id=OLD.id OR user_id=OLD.id UNION SELECT collection_id FROM family_tree_mutation_receipts WHERE actor_user_id=OLD.id UNION SELECT collection_id FROM family_tree_media_assets WHERE created_by_user_id=OLD.id UNION SELECT collection_id FROM family_tree_media_references WHERE created_by_user_id=OLD.id UNION SELECT collection_id FROM family_tree_media_pins WHERE created_by_user_id=OLD.id UNION SELECT collection_id FROM family_tree_transfer_jobs WHERE actor_user_id=OLD.id UNION SELECT collection_id FROM family_tree_import_source_keys WHERE created_by_user_id=OLD.id); END'


def upgrade():
    for table, column in [('homeschool_attendance', 'subject_id'), ('homeschool_grades', 'subject_id'), ('homeschool_grades', 'semester_id')]:
        op.create_index(f'ix_{table}_{column}', table, [column], unique=False)
    op.execute('DROP TRIGGER IF EXISTS trg_ft_users_delete')
    op.execute(USER_DELETE_TRIGGER)


def downgrade():
    raise RuntimeError('Family Tree migrations are disable-only; preserve genealogy and attribution guards.')
