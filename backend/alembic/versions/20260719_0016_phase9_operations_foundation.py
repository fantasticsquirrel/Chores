"""Add household ownership, platform operations, and billing foundation.

Revision ID: 20260719_0016
Revises: 20260715_0015
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260719_0016"
down_revision = "20260715_0015"
branch_labels = None
depends_on = None


def _timestamps() -> list[sa.Column]:
    return [sa.Column("created_at", sa.DateTime(timezone=True), nullable=False)]


def _install_sqlite_guards() -> None:
    if op.get_bind().dialect.name != "sqlite":
        return
    statements = (

        """CREATE TRIGGER trg_households_owner_update BEFORE UPDATE OF owner_user_id ON households
        WHEN NEW.owner_user_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM users WHERE id=NEW.owner_user_id AND household_id=NEW.id
            AND active=1 AND role IN ('PARENT_ADMIN','PARENT'))
        BEGIN SELECT RAISE(ABORT, 'owner must be an active parent in the same household'); END""",
        """CREATE TRIGGER trg_users_protect_owner_update BEFORE UPDATE OF household_id, active, role ON users
        WHEN EXISTS (SELECT 1 FROM households WHERE owner_user_id=OLD.id)
          AND (NEW.household_id != OLD.household_id OR NEW.active != 1 OR NEW.role NOT IN ('PARENT_ADMIN','PARENT'))
        BEGIN SELECT RAISE(ABORT, 'current owner cannot be moved, deactivated, or demoted'); END""",
        """CREATE TRIGGER trg_users_protect_owner_delete BEFORE DELETE ON users
        WHEN EXISTS (SELECT 1 FROM households WHERE owner_user_id=OLD.id)
        BEGIN SELECT RAISE(ABORT, 'current owner cannot be deleted'); END""",
    )
    for table in ("billing_events", "platform_audit_events", "support_case_notes"):
        statements += (
            f"CREATE TRIGGER trg_{table}_append_only_update BEFORE UPDATE ON {table} BEGIN SELECT RAISE(ABORT, 'append-only record'); END",
            f"CREATE TRIGGER trg_{table}_append_only_delete BEFORE DELETE ON {table} BEGIN SELECT RAISE(ABORT, 'append-only record'); END",
        )
    for statement in statements:
        op.execute(sa.text(statement))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "households" in tables and "users" not in tables:
        raise RuntimeError("Phase 9 requires core tables; missing: users")
    if not {"households", "users"} <= tables:
        # Legacy subsystem-only fixtures contain no household data to migrate.
        return
    if "owner_user_id" not in {column["name"] for column in inspector.get_columns("households")}:
        op.add_column("households", sa.Column("owner_user_id", sa.Integer(), nullable=True))

    op.execute(sa.text("""
        UPDATE households SET owner_user_id = COALESCE(
          (SELECT MIN(u.id) FROM users u WHERE u.household_id=households.id AND u.active=1 AND u.role='PARENT_ADMIN'),
          (SELECT MIN(u.id) FROM users u WHERE u.household_id=households.id AND u.active=1 AND u.role='PARENT')
        ) WHERE owner_user_id IS NULL
    """))
    ownerless = bind.execute(sa.text("SELECT id FROM households WHERE owner_user_id IS NULL ORDER BY id LIMIT 1")).scalar_one_or_none()
    if ownerless is not None:
        raise RuntimeError(f"household {ownerless} has no active parent eligible for ownership")

    with op.batch_alter_table("households") as batch:
        batch.alter_column("owner_user_id", existing_type=sa.Integer(), nullable=False)
        batch.create_foreign_key("fk_households_owner_user_id_users", "users", ["owner_user_id"], ["id"], ondelete="RESTRICT", deferrable=True, initially="DEFERRED")
        batch.create_unique_constraint("uq_households_owner_user_id", ["owner_user_id"])
    op.create_index("ix_households_owner_user_id", "households", ["owner_user_id"], unique=False)

    op.create_table(
        "platform_users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("totp_secret_ciphertext", sa.Text(), nullable=False),
        sa.Column("totp_key_version", sa.String(32), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_platform_users"),
        sa.UniqueConstraint("email", name="uq_platform_users_email"),
    )
    op.create_index("ix_platform_users_email", "platform_users", ["email"])
    op.create_table(
        "platform_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("platform_user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("mfa_verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recent_reauth_at", sa.DateTime(timezone=True), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(["platform_user_id"], ["platform_users.id"], ondelete="CASCADE", name="fk_platform_sessions_platform_user_id_platform_users"),
        sa.PrimaryKeyConstraint("id", name="pk_platform_sessions"),
        sa.UniqueConstraint("token_hash", name="uq_platform_sessions_token_hash"),
    )
    for name, column in (("ix_platform_sessions_platform_user_id", "platform_user_id"), ("ix_platform_sessions_token_hash", "token_hash"), ("ix_platform_sessions_expires_at", "expires_at")):
        op.create_index(name, "platform_sessions", [column])

    op.create_table(
        "billing_accounts",
        sa.Column("id", sa.Integer(), nullable=False), sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("public_id", sa.String(36), nullable=False), *_timestamps(),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE", name="fk_billing_accounts_household_id_households"),
        sa.PrimaryKeyConstraint("id", name="pk_billing_accounts"),
        sa.UniqueConstraint("household_id", name="uq_billing_accounts_household_id"), sa.UniqueConstraint("public_id", name="uq_billing_accounts_public_id"),
    )
    op.create_index("ix_billing_accounts_household_id", "billing_accounts", ["household_id"])
    op.create_index("ix_billing_accounts_public_id", "billing_accounts", ["public_id"])
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), nullable=False), sa.Column("billing_account_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(64), nullable=True), sa.Column("provider_subscription_id", sa.String(255), nullable=True),
        sa.Column("plan_key", sa.String(64), nullable=False), sa.Column("status", sa.String(15), nullable=False),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True), *_timestamps(),
        sa.ForeignKeyConstraint(["billing_account_id"], ["billing_accounts.id"], ondelete="CASCADE", name="fk_subscriptions_billing_account_id_billing_accounts"),
        sa.PrimaryKeyConstraint("id", name="pk_subscriptions"),
    )
    op.create_index("ix_subscriptions_billing_account_id", "subscriptions", ["billing_account_id"])
    op.create_table(
        "billing_customer_references",
        sa.Column("id", sa.Integer(), nullable=False), sa.Column("billing_account_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(64), nullable=False), sa.Column("provider_customer_id", sa.String(255), nullable=False), *_timestamps(),
        sa.ForeignKeyConstraint(["billing_account_id"], ["billing_accounts.id"], ondelete="CASCADE", name="fk_billing_customer_references_billing_account_id_billing_accounts"),
        sa.PrimaryKeyConstraint("id", name="pk_billing_customer_references"),
        sa.UniqueConstraint("provider", "provider_customer_id", name="uq_billing_customer_references_provider_customer"),
    )
    op.create_index("ix_billing_customer_references_billing_account_id", "billing_customer_references", ["billing_account_id"])
    op.create_table(
        "billing_events",
        sa.Column("id", sa.Integer(), nullable=False), sa.Column("billing_account_id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False), sa.Column("source", sa.String(64), nullable=False),
        sa.Column("idempotency_key", sa.String(255), nullable=False), sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False), sa.Column("payload_json", sa.Text(), nullable=False), *_timestamps(),
        sa.ForeignKeyConstraint(["billing_account_id"], ["billing_accounts.id"], ondelete="CASCADE", name="fk_billing_events_billing_account_id_billing_accounts"),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE", name="fk_billing_events_household_id_households"),
        sa.PrimaryKeyConstraint("id", name="pk_billing_events"),
        sa.UniqueConstraint("source", "idempotency_key", name="uq_billing_events_source_key"),
    )
    for name, column in (("ix_billing_events_billing_account_id", "billing_account_id"), ("ix_billing_events_household_id", "household_id"), ("ix_billing_events_event_type", "event_type"), ("ix_billing_events_occurred_at", "occurred_at")):
        op.create_index(name, "billing_events", [column])
    op.create_table(
        "household_entitlements",
        sa.Column("household_id", sa.Integer(), nullable=False), sa.Column("billing_account_id", sa.Integer(), nullable=False),
        sa.Column("plan_key", sa.String(64), nullable=False), sa.Column("status", sa.String(15), nullable=False),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True), sa.Column("projected_event_id", sa.Integer(), nullable=True),
        sa.Column("projected_occurred_at", sa.DateTime(timezone=True), nullable=True), *_timestamps(),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE", name="fk_household_entitlements_household_id_households"),
        sa.ForeignKeyConstraint(["billing_account_id"], ["billing_accounts.id"], ondelete="CASCADE", name="fk_household_entitlements_billing_account_id_billing_accounts"),
        sa.ForeignKeyConstraint(["projected_event_id"], ["billing_events.id"], ondelete="RESTRICT", name="fk_household_entitlements_projected_event_id_billing_events"),
        sa.PrimaryKeyConstraint("household_id", name="pk_household_entitlements"), sa.UniqueConstraint("billing_account_id", name="uq_household_entitlements_billing_account_id"),
    )

    op.create_table(
        "platform_audit_events",
        sa.Column("id", sa.Integer(), nullable=False), sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("actor_platform_user_id", sa.Integer(), nullable=True), sa.Column("household_id", sa.Integer(), nullable=True),
        sa.Column("reason", sa.String(1000), nullable=False), sa.Column("details_json", sa.Text(), nullable=False), *_timestamps(),
        sa.ForeignKeyConstraint(["actor_platform_user_id"], ["platform_users.id"], ondelete="SET NULL", name="fk_platform_audit_events_actor_platform_user_id_platform_users"),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="SET NULL", name="fk_platform_audit_events_household_id_households"),
        sa.PrimaryKeyConstraint("id", name="pk_platform_audit_events"),
    )
    for name, column in (("ix_platform_audit_events_event_type", "event_type"), ("ix_platform_audit_events_actor_platform_user_id", "actor_platform_user_id"), ("ix_platform_audit_events_household_id", "household_id")):
        op.create_index(name, "platform_audit_events", [column])
    op.create_table(
        "support_cases",
        sa.Column("id", sa.Integer(), nullable=False), sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("opened_by_platform_user_id", sa.Integer(), nullable=False), sa.Column("reason", sa.String(1000), nullable=False),
        sa.Column("status", sa.String(32), nullable=False), *_timestamps(),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="RESTRICT", name="fk_support_cases_household_id_households"),
        sa.ForeignKeyConstraint(["opened_by_platform_user_id"], ["platform_users.id"], ondelete="RESTRICT", name="fk_support_cases_opened_by_platform_user_id_platform_users"),
        sa.PrimaryKeyConstraint("id", name="pk_support_cases"),
    )
    op.create_index("ix_support_cases_household_id", "support_cases", ["household_id"])
    op.create_table(
        "support_case_notes",
        sa.Column("id", sa.Integer(), nullable=False), sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("author_platform_user_id", sa.Integer(), nullable=False), sa.Column("body", sa.String(4000), nullable=False), *_timestamps(),
        sa.ForeignKeyConstraint(["case_id"], ["support_cases.id"], ondelete="RESTRICT", name="fk_support_case_notes_case_id_support_cases"),
        sa.ForeignKeyConstraint(["author_platform_user_id"], ["platform_users.id"], ondelete="RESTRICT", name="fk_support_case_notes_author_platform_user_id_platform_users"),
        sa.PrimaryKeyConstraint("id", name="pk_support_case_notes"), sa.UniqueConstraint("case_id", "id", name="uq_support_case_notes_case_id"),
    )
    op.create_index("ix_support_case_notes_case_id", "support_case_notes", ["case_id"])
    _install_sqlite_guards()


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    if bind.dialect.name == "sqlite":
        for name in (
            "trg_households_owner_insert", "trg_households_owner_update", "trg_users_protect_owner_update", "trg_users_protect_owner_delete",
            "trg_billing_events_append_only_update", "trg_billing_events_append_only_delete", "trg_platform_audit_events_append_only_update",
            "trg_platform_audit_events_append_only_delete", "trg_support_case_notes_append_only_update", "trg_support_case_notes_append_only_delete",
        ):
            op.execute(sa.text(f"DROP TRIGGER IF EXISTS {name}"))
    for table in ("support_case_notes", "support_cases", "platform_audit_events", "household_entitlements", "billing_events", "billing_customer_references", "subscriptions", "billing_accounts", "platform_sessions", "platform_users"):
        if table in existing_tables:
            op.drop_table(table)
    if "households" not in existing_tables:
        return
    owner_columns = {column["name"] for column in inspector.get_columns("households")}
    if "owner_user_id" not in owner_columns:
        return
    op.drop_index("ix_households_owner_user_id", table_name="households")
    with op.batch_alter_table("households") as batch:
        batch.drop_constraint("uq_households_owner_user_id", type_="unique")
        batch.drop_constraint("fk_households_owner_user_id_users", type_="foreignkey")
        batch.drop_column("owner_user_id")
