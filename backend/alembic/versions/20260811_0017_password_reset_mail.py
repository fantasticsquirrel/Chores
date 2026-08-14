"""Add digest-backed password reset capabilities and secret-free mail outbox.

Revision ID: 20260811_0017
Revises: 20260719_0016
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260811_0017"
down_revision = "20260719_0016"
branch_labels = None
depends_on = None


_IDENTITY_TABLES = frozenset(("users", "households"))
_IDENTITY_ARTIFACTS = _IDENTITY_TABLES | frozenset(("auth_sessions",))
_RESET_TABLES = (
    "password_reset_deliveries",
    "password_reset_requests",
    "password_resets",
)


def _timestamps() -> list[sa.Column]:
    return [sa.Column("created_at", sa.DateTime(timezone=True), nullable=False)]


def _has_identity_schema(tables: set[str], *, operation: str) -> bool:
    """Return whether this revision has identity tables to extend.

    Historical subsystem-only fixtures legitimately have no identity/session
    artifacts. They may advance through this revision as a no-op only when no
    reset artifact exists. Any partial identity/reset schema is drift: refusing
    it prevents an Alembic version stamp from claiming ownership of out-of-band
    objects.
    """
    present_reset = sorted(tables & set(_RESET_TABLES))
    present_identity = sorted(tables & _IDENTITY_ARTIFACTS)
    missing_identity = sorted(_IDENTITY_ARTIFACTS - tables)
    if missing_identity:
        # A no-op is safe only for a truly absent historical subsystem. Any
        # identity/session artifact without the complete household identity
        # schema would otherwise let Alembic stamp past this revision while
        # leaving the reset tables absent.
        if present_reset:
            raise RuntimeError(
                f"Password reset {operation} refuses reset tables without complete identity schema "
                f"(missing: {', '.join(missing_identity)}): " + ", ".join(present_reset)
            )
        if present_identity:
            raise RuntimeError(
                f"Password reset {operation} refuses incomplete identity schema "
                f"(missing: {', '.join(missing_identity)}; present: {', '.join(present_identity)})"
            )
        return False
    return True


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if not _has_identity_schema(tables, operation="migration"):
        return

    # This revision owns the reset artifacts only when it creates all of them.
    # Never silently adopt an independently created table that a later downgrade
    # could delete.
    preexisting = sorted(tables & set(_RESET_TABLES))
    if preexisting:
        raise RuntimeError(
            "Password reset migration refuses schema drift: reset tables already exist: " + ", ".join(preexisting)
        )

    op.create_table(
        "password_resets",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_key_version", sa.String(length=64), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invalidated_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.CheckConstraint("length(token_key_version) > 0", name="password_reset_token_key_version_nonempty"),
        sa.CheckConstraint("length(token_digest) = 64", name="password_reset_token_digest_length"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE", name="fk_password_resets_user_id_users"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_password_resets"),
        sa.UniqueConstraint("token_digest", name="uq_password_resets_token_digest"),
    )
    op.create_index("ix_password_resets_user_id", "password_resets", ["user_id"])
    op.create_index("ix_password_resets_expires_at", "password_resets", ["expires_at"])
    op.create_index("ix_password_resets_consumed_at", "password_resets", ["consumed_at"])
    op.create_index("ix_password_resets_invalidated_at", "password_resets", ["invalidated_at"])
    op.create_index(
        "uq_password_resets_one_active_user",
        "password_resets",
        ["user_id"],
        unique=True,
        sqlite_where=sa.text("consumed_at IS NULL AND invalidated_at IS NULL"),
        postgresql_where=sa.text("consumed_at IS NULL AND invalidated_at IS NULL"),
    )

    op.create_table(
        "password_reset_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("household_id", sa.Integer(), nullable=True),
        sa.Column("email_key_hash", sa.String(length=64), nullable=False),
        sa.Column("ip_key_hash", sa.String(length=64), nullable=False),
        sa.Column("outcome", sa.String(length=64), nullable=False),
        *_timestamps(),
        sa.CheckConstraint(
            "length(email_key_hash) = 64", name="password_reset_request_email_key_hash_length"
        ),
        sa.CheckConstraint("length(ip_key_hash) = 64", name="password_reset_request_ip_key_hash_length"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="SET NULL", name="fk_password_reset_requests_user_id_users"
        ),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            ondelete="SET NULL",
            name="fk_password_reset_requests_household_id_households",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_password_reset_requests"),
    )
    op.create_index("ix_password_reset_requests_user_id", "password_reset_requests", ["user_id"])
    op.create_index("ix_password_reset_requests_household_id", "password_reset_requests", ["household_id"])
    op.create_index(
        "ix_password_reset_requests_email_created", "password_reset_requests", ["email_key_hash", "created_at"]
    )
    op.create_index(
        "ix_password_reset_requests_ip_created", "password_reset_requests", ["ip_key_hash", "created_at"]
    )
    op.create_index(
        "ix_password_reset_requests_household_created",
        "password_reset_requests",
        ["household_id", "created_at"],
    )

    op.create_table(
        "password_reset_deliveries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("password_reset_id", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_by_mta_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("terminal_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error_code", sa.String(length=64), nullable=False, server_default=""),
        *_timestamps(),
        sa.CheckConstraint("kind IN ('reset_link', 'password_changed')", name="password_reset_delivery_kind"),
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'retry', 'accepted', 'cancelled', 'dead')",
            name="password_reset_delivery_status",
        ),
        sa.CheckConstraint(
            "attempt_count >= 0", name="password_reset_delivery_attempt_count_nonnegative"
        ),
        sa.ForeignKeyConstraint(
            ["password_reset_id"],
            ["password_resets.id"],
            ondelete="CASCADE",
            name="fk_password_reset_deliveries_password_reset_id_password_resets",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_password_reset_deliveries"),
        sa.UniqueConstraint("password_reset_id", "kind", name="uq_password_reset_deliveries_reset_kind"),
    )
    op.create_index(
        "ix_password_reset_deliveries_password_reset_id", "password_reset_deliveries", ["password_reset_id"]
    )
    op.create_index(
        "ix_password_reset_deliveries_status_available", "password_reset_deliveries", ["status", "available_at"]
    )
    op.create_index(
        "ix_password_reset_deliveries_lease_expires_at", "password_reset_deliveries", ["lease_expires_at"]
    )


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if not _has_identity_schema(tables, operation="downgrade"):
        return

    # Normal upgrades create all three tables atomically from Alembic's point of
    # view. A partial footprint implies a damaged or externally altered schema;
    # do not delete the remaining data while pretending rollback succeeded.
    missing = sorted(set(_RESET_TABLES) - tables)
    if missing:
        raise RuntimeError("Password reset downgrade refuses incomplete schema; missing: " + ", ".join(missing))

    for table in _RESET_TABLES:
        op.drop_table(table)
