from __future__ import annotations

from sqlalchemy import CheckConstraint

from app.db import Base
from app.models import ALL_MODELS


def test_all_core_tables_registered() -> None:
    _ = ALL_MODELS

    expected_tables = {
        "households",
        "users",
        "children",
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

    assert expected_tables.issubset(set(Base.metadata.tables.keys()))


def test_chore_timeout_days_is_nullable_integer() -> None:
    _ = ALL_MODELS

    chores_table = Base.metadata.tables["chores"]
    timeout_days = chores_table.c.timeout_days

    assert timeout_days.nullable is True
    assert timeout_days.type.python_type is int


def test_user_role_child_link_constraint_present() -> None:
    _ = ALL_MODELS

    users_table = Base.metadata.tables["users"]
    check_names = {constraint.name for constraint in users_table.constraints if isinstance(constraint, CheckConstraint)}

    assert "ck_users_user_role_child_link" in check_names
