"""Quarantine delivery attempts that survived the original queue deduplication.

Revision ID: 20260715_0015
Revises: 20260715_0014
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260715_0015"
down_revision = "20260715_0014"
branch_labels = None
depends_on = None



def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("notification_delivery_attempts"):
        return

    # The first deployed 0012 retained MIN(id) while deduplicating. A retained
    # unsent row might therefore have had a later successful sibling removed.
    # Its provenance cannot be reconstructed, so fail closed rather than risk
    # sending the same household notification again.
    op.execute(
        sa.text(
            """
            UPDATE notification_delivery_attempts
            SET status = 'dead',
                error_message = 'legacy-dedup-audit-required'
            WHERE status IN ('pending', 'retry', 'processing')
            """
        )
    )


def downgrade() -> None:
    # Quarantined deliveries cannot safely be reactivated automatically.
    pass
