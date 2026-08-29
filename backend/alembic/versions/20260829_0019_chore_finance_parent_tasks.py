"""restore child finance and parent personal chores

Revision ID: 20260829_0019
Revises: 20260813_0018
"""
from alembic import op
import sqlalchemy as sa

revision = "20260829_0019"
down_revision = "20260813_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("chores") as batch:
        batch.add_column(sa.Column("owner_user_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_chores_owner_user_id_users", "users", ["owner_user_id"], ["id"], ondelete="CASCADE")
        batch.create_index("ix_chores_owner_user_id", ["owner_user_id"])
    with op.batch_alter_table("transactions") as batch:
        batch.add_column(sa.Column("memo", sa.String(length=500), server_default="", nullable=False))
        batch.add_column(sa.Column("created_by_user_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_transactions_created_by_user_id_users", "users", ["created_by_user_id"], ["id"], ondelete="SET NULL")
        batch.create_index("ix_transactions_created_by_user_id", ["created_by_user_id"])
    op.create_table(
        "parent_chore_completions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chore_id", sa.Integer(), sa.ForeignKey("chores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("chore_id", "user_id", "date"),
    )
    op.create_index("ix_parent_chore_completions_household_id", "parent_chore_completions", ["household_id"])
    op.create_index("ix_parent_chore_completions_chore_id", "parent_chore_completions", ["chore_id"])
    op.create_index("ix_parent_chore_completions_user_id", "parent_chore_completions", ["user_id"])
    op.create_index("ix_parent_chore_completions_date", "parent_chore_completions", ["date"])


def downgrade() -> None:
    op.drop_table("parent_chore_completions")
    with op.batch_alter_table("transactions") as batch:
        batch.drop_index("ix_transactions_created_by_user_id")
        batch.drop_constraint("fk_transactions_created_by_user_id_users", type_="foreignkey")
        batch.drop_column("created_by_user_id")
        batch.drop_column("memo")
    with op.batch_alter_table("chores") as batch:
        batch.drop_index("ix_chores_owner_user_id")
        batch.drop_constraint("fk_chores_owner_user_id_users", type_="foreignkey")
        batch.drop_column("owner_user_id")
