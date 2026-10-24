"""Household-scoped immutable Discovery packages and version-bound child grants.

Downgrade unpublishes packages and revokes execution, retaining uploaded versions
for recovery. Re-upgrade is idempotent and does not silently republish them.
"""

from alembic import op
import sqlalchemy as sa

revision = "20261024_0031"
down_revision = "20261024_0030"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("discovery_packages"):
        op.create_table(
            "discovery_packages",
            sa.Column("household_id", sa.Integer(), primary_key=True),
            sa.Column("package_id", sa.String(80), primary_key=True),
            sa.Column("published_version", sa.String(60), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["household_id"], ["households.id"], ondelete="CASCADE"
            ),
        )
    if not inspector.has_table("discovery_package_versions"):
        op.create_table(
            "discovery_package_versions",
            sa.Column("household_id", sa.Integer(), primary_key=True),
            sa.Column("package_id", sa.String(80), primary_key=True),
            sa.Column("version", sa.String(60), primary_key=True),
            sa.Column("runtime", sa.String(30), nullable=False),
            sa.Column("checksum", sa.String(64), nullable=False),
            sa.Column("payload_json", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["household_id", "package_id"],
                ["discovery_packages.household_id", "discovery_packages.package_id"],
                ondelete="CASCADE",
            ),
        )
    if not inspector.has_table("discovery_package_grants"):
        op.create_table(
            "discovery_package_grants",
            sa.Column("household_id", sa.Integer(), primary_key=True),
            sa.Column("child_id", sa.Integer(), primary_key=True),
            sa.Column("package_id", sa.String(80), primary_key=True),
            sa.Column("version", sa.String(60), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["child_id", "household_id"],
                ["children.id", "children.household_id"],
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["household_id", "package_id", "version"],
                [
                    "discovery_package_versions.household_id",
                    "discovery_package_versions.package_id",
                    "discovery_package_versions.version",
                ],
                ondelete="CASCADE",
            ),
        )


def downgrade():
    op.get_bind().execute(
        sa.text("UPDATE discovery_packages SET published_version=NULL")
    )
    op.get_bind().execute(sa.text("UPDATE discovery_package_grants SET enabled=0"))
