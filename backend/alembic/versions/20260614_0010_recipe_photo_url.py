"""add recipe photo url

Revision ID: 20260614_0010
Revises: 20260614_0009
Create Date: 2026-06-14 18:20:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260614_0010"
down_revision = "20260614_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("recipes", sa.Column("photo_url", sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column("recipes", "photo_url")
