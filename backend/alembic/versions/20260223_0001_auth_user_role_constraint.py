"""Create the frozen core schema or harden an existing users table.

Revision ID: 20260223_0001
Revises:
Create Date: 2026-02-23 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260223_0001"
down_revision = None
branch_labels = None
depends_on = None

USER_ROLE_CHILD_CHECK = (
    "(role = 'CHILD' AND child_id IS NOT NULL) OR "
    "(role IN ('PARENT_ADMIN', 'PARENT') AND child_id IS NULL)"
)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "users" in inspector.get_table_names():
        _add_user_role_constraint_if_missing(inspector)
        return

    _create_frozen_core_schema()


def _add_user_role_constraint_if_missing(inspector: sa.Inspector) -> None:
    constraint_name = "ck_users_user_role_child_link"
    existing = {constraint["name"] for constraint in inspector.get_check_constraints("users")}
    if constraint_name in existing:
        return

    with op.batch_alter_table("users", recreate="always") as batch_op:
        batch_op.create_check_constraint(constraint_name, USER_ROLE_CHILD_CHECK)


def _create_frozen_core_schema() -> None:
    op.create_table(
        "households",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_households"),
    )
    op.create_table(
        "children",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE", name="fk_children_household_id_households"),
        sa.PrimaryKeyConstraint("id", name="pk_children"),
    )
    op.create_index("ix_children_household_id", "children", ["household_id"])

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("role", sa.String(length=12), nullable=False),
        sa.Column("child_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(USER_ROLE_CHILD_CHECK, name=op.f("ck_users_user_role_child_link")),
        sa.ForeignKeyConstraint(["child_id"], ["children.id"], ondelete="SET NULL", name="fk_users_child_id_children"),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE", name="fk_users_household_id_households"),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("household_id", "email", name="uq_users_household_id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_child_id", "users", ["child_id"])
    op.create_index("ix_users_household_id", "users", ["household_id"])

    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE", name="fk_tags_household_id_households"),
        sa.PrimaryKeyConstraint("id", name="pk_tags"),
        sa.UniqueConstraint("household_id", "name", name="uq_tags_household_id"),
    )
    op.create_index("ix_tags_household_id", "tags", ["household_id"])

    op.create_table(
        "chores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("reward_cents", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("expires_at", sa.Date(), nullable=True),
        sa.Column("timeout_days", sa.Integer(), nullable=True),
        sa.Column("schedule_mode", sa.String(length=16), nullable=False),
        sa.Column("schedule_interval", sa.Integer(), nullable=True),
        sa.Column("schedule_unit", sa.String(length=5), nullable=True),
        sa.Column("completion_mode", sa.String(length=9), nullable=False),
        sa.Column("assignment_mode", sa.String(length=8), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("reward_cents >= 0", name=op.f("ck_chores_reward_non_negative")),
        sa.CheckConstraint("schedule_interval IS NULL OR schedule_interval > 0", name=op.f("ck_chores_positive_schedule_interval")),
        sa.CheckConstraint("timeout_days IS NULL OR timeout_days > 0", name=op.f("ck_chores_positive_timeout_days")),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE", name="fk_chores_household_id_households"),
        sa.PrimaryKeyConstraint("id", name="pk_chores"),
    )
    op.create_index("ix_chores_household_id", "chores", ["household_id"])

    op.create_table(
        "chore_allowed_children",
        sa.Column("chore_id", sa.Integer(), nullable=False),
        sa.Column("child_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["child_id"], ["children.id"], ondelete="CASCADE", name="fk_chore_allowed_children_child_id_children"),
        sa.ForeignKeyConstraint(["chore_id"], ["chores.id"], ondelete="CASCADE", name="fk_chore_allowed_children_chore_id_chores"),
        sa.PrimaryKeyConstraint("chore_id", "child_id", name="pk_chore_allowed_children"),
    )
    op.create_table(
        "chore_rotation_members",
        sa.Column("chore_id", sa.Integer(), nullable=False),
        sa.Column("child_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["child_id"], ["children.id"], ondelete="CASCADE", name="fk_chore_rotation_members_child_id_children"),
        sa.ForeignKeyConstraint(["chore_id"], ["chores.id"], ondelete="CASCADE", name="fk_chore_rotation_members_chore_id_chores"),
        sa.PrimaryKeyConstraint("chore_id", "child_id", name="pk_chore_rotation_members"),
        sa.UniqueConstraint("chore_id", "position", name="uq_chore_rotation_members_chore_id"),
    )
    op.create_table(
        "chore_rotation_state",
        sa.Column("chore_id", sa.Integer(), nullable=False),
        sa.Column("current_position", sa.Integer(), nullable=False),
        sa.Column("last_occurrence_date", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(["chore_id"], ["chores.id"], ondelete="CASCADE", name="fk_chore_rotation_state_chore_id_chores"),
        sa.PrimaryKeyConstraint("chore_id", name="pk_chore_rotation_state"),
    )

    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("child_id", sa.Integer(), nullable=False),
        sa.Column("for_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["child_id"], ["children.id"], ondelete="CASCADE", name="fk_submissions_child_id_children"),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE", name="fk_submissions_household_id_households"),
        sa.PrimaryKeyConstraint("id", name="pk_submissions"),
    )
    op.create_index("ix_submissions_child_id", "submissions", ["child_id"])
    op.create_index("ix_submissions_for_date", "submissions", ["for_date"])
    op.create_index("ix_submissions_household_id", "submissions", ["household_id"])

    op.create_table(
        "submission_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("submission_id", sa.Integer(), nullable=False),
        sa.Column("chore_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=8), nullable=False),
        sa.ForeignKeyConstraint(["chore_id"], ["chores.id"], ondelete="CASCADE", name="fk_submission_items_chore_id_chores"),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE", name="fk_submission_items_submission_id_submissions"),
        sa.PrimaryKeyConstraint("id", name="pk_submission_items"),
    )
    op.create_index("ix_submission_items_chore_id", "submission_items", ["chore_id"])
    op.create_index("ix_submission_items_submission_id", "submission_items", ["submission_id"])

    op.create_table(
        "completion_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("child_id", sa.Integer(), nullable=False),
        sa.Column("chore_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=8), nullable=False),
        sa.ForeignKeyConstraint(["child_id"], ["children.id"], ondelete="CASCADE", name="fk_completion_records_child_id_children"),
        sa.ForeignKeyConstraint(["chore_id"], ["chores.id"], ondelete="CASCADE", name="fk_completion_records_chore_id_chores"),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE", name="fk_completion_records_household_id_households"),
        sa.PrimaryKeyConstraint("id", name="pk_completion_records"),
        sa.UniqueConstraint("child_id", "chore_id", "date", name="uq_completion_records_child_id"),
    )
    op.create_index("ix_completion_records_child_id", "completion_records", ["child_id"])
    op.create_index("ix_completion_records_chore_id", "completion_records", ["chore_id"])
    op.create_index("ix_completion_records_household_id", "completion_records", ["household_id"])

    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("child_id", sa.Integer(), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=14), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["child_id"], ["children.id"], ondelete="CASCADE", name="fk_transactions_child_id_children"),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE", name="fk_transactions_household_id_households"),
        sa.PrimaryKeyConstraint("id", name="pk_transactions"),
    )
    op.create_index("ix_transactions_child_id", "transactions", ["child_id"])
    op.create_index("ix_transactions_household_id", "transactions", ["household_id"])

    op.create_table(
        "quick_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("reward_cents", sa.Integer(), nullable=False),
        sa.Column("completion_mode", sa.String(length=9), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE", name="fk_quick_templates_household_id_households"),
        sa.PrimaryKeyConstraint("id", name="pk_quick_templates"),
    )
    op.create_index("ix_quick_templates_household_id", "quick_templates", ["household_id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    core_tables = {
        "households",
        "children",
        "users",
        "tags",
        "chores",
        "chore_allowed_children",
        "chore_rotation_members",
        "chore_rotation_state",
        "submissions",
        "submission_items",
        "completion_records",
        "transactions",
        "quick_templates",
    }
    if core_tables <= set(inspector.get_table_names()):
        for table_name in (
            "quick_templates",
            "transactions",
            "completion_records",
            "submission_items",
            "submissions",
            "chore_rotation_state",
            "chore_rotation_members",
            "chore_allowed_children",
            "chores",
            "tags",
            "users",
            "children",
            "households",
        ):
            op.drop_table(table_name)
        return

    if "users" in inspector.get_table_names():
        existing = {constraint["name"] for constraint in inspector.get_check_constraints("users")}
        if "ck_users_user_role_child_link" in existing:
            with op.batch_alter_table("users", recreate="always") as batch_op:
                batch_op.drop_constraint("ck_users_user_role_child_link", type_="check")
