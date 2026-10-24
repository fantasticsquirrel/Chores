"""Discovery Lab per-child access, explicitly household opt-in.

Existing households receive disabled rows. New households are denied on missing
rows by the module service. Downgrade preserves access preferences and disables
the module rather than deleting user data.
"""

from alembic import op
import sqlalchemy as sa

revision = "20261024_0030"
down_revision = "20261014_0029"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if not sa.inspect(bind).has_table("discovery_exploration_access"):
        op.create_table(
            "discovery_exploration_access",
            sa.Column("household_id", sa.Integer(), primary_key=True),
            sa.Column("child_id", sa.Integer(), primary_key=True),
            sa.Column("exploration_id", sa.String(80), primary_key=True),
            sa.Column("enabled", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["child_id", "household_id"],
                ["children.id", "children.household_id"],
                ondelete="CASCADE",
            ),
        )
    bind.execute(
        sa.text(
            "INSERT INTO modules (key,name,description,enabled) VALUES ('discovery-lab','Discovery Lab','Interactive explorations with parent-controlled learning access.',1) ON CONFLICT(key) DO NOTHING"
        )
    )
    bind.execute(
        sa.text(
            "INSERT INTO household_module_access (household_id,module_key,enabled,created_at) SELECT id,'discovery-lab',0,CURRENT_TIMESTAMP FROM households WHERE id NOT IN (SELECT household_id FROM household_module_access WHERE module_key='discovery-lab')"
        )
    )


def downgrade():
    op.get_bind().execute(
        sa.text("UPDATE modules SET enabled=0 WHERE key='discovery-lab'")
    )
    op.get_bind().execute(
        sa.text(
            "UPDATE household_module_access SET enabled=0 WHERE module_key='discovery-lab'"
        )
    )
