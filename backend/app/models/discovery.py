"""Bundled exploration overrides and default-deny uploaded package grants."""

from sqlalchemy import Boolean, ForeignKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base, TimestampMixin


class DiscoveryExplorationAccess(TimestampMixin, Base):
    __tablename__ = "discovery_exploration_access"
    __table_args__ = (
        ForeignKeyConstraint(
            ["child_id", "household_id"],
            ["children.id", "children.household_id"],
            ondelete="CASCADE",
        ),
    )
    household_id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(primary_key=True)
    exploration_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)


class DiscoveryPackage(TimestampMixin, Base):
    """Household-owned publication pointer; archive versions are immutable."""

    __tablename__ = "discovery_packages"
    __table_args__ = (
        ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
    )
    household_id: Mapped[int] = mapped_column(primary_key=True)
    package_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    published_version: Mapped[str | None] = mapped_column(String(60), nullable=True)


class DiscoveryPackageVersion(TimestampMixin, Base):
    __tablename__ = "discovery_package_versions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["household_id", "package_id"],
            ["discovery_packages.household_id", "discovery_packages.package_id"],
            ondelete="CASCADE",
        ),
    )
    household_id: Mapped[int] = mapped_column(primary_key=True)
    package_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    version: Mapped[str] = mapped_column(String(60), primary_key=True)
    runtime: Mapped[str] = mapped_column(String(30))
    checksum: Mapped[str] = mapped_column(String(64))
    payload_json: Mapped[str] = mapped_column(String, nullable=False)


class DiscoveryPackageGrant(TimestampMixin, Base):
    __tablename__ = "discovery_package_grants"
    __table_args__ = (
        ForeignKeyConstraint(
            ["child_id", "household_id"],
            ["children.id", "children.household_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["household_id", "package_id", "version"],
            [
                "discovery_package_versions.household_id",
                "discovery_package_versions.package_id",
                "discovery_package_versions.version",
            ],
            ondelete="CASCADE",
        ),
    )
    household_id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(primary_key=True)
    package_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    version: Mapped[str] = mapped_column(String(60), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
