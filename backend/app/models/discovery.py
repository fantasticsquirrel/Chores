"""Per-child materialized exploration overrides. Missing overrides mean enabled."""

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
