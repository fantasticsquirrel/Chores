from __future__ import annotations

from datetime import date
from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.config import Settings
from app.db import get_session_factory, initialize_database
from app.models.chores import Chore, ParentChoreCompletion
from app.models.enums import AssignmentMode, CompletionMode, ScheduleMode, UserRole
from app.models.identity import Child, Household, User
from app.schemas.chores import CreateChoreRequest, UpdateChoreRequest
from app.services.chores.management import (
    create_household_chore,
    get_household_chore_or_404,
    update_household_chore,
)
from app.services.chores.parent_tasks import complete_parent_chore
from app.services.chores.serialization import serialize_chore


def _settings(database_url: str) -> Settings:
    return Settings(
        app_env="test",
        database_url=database_url,
        secret_key="a" * 32,
        log_level="INFO",
        session_cookie_secure=False,
    )


def _seed_family(session_factory) -> dict[str, int]:
    with session_factory() as session:
        household = Household(name="Home", timezone="UTC")
        other_household = Household(name="Other", timezone="UTC")
        session.add_all([household, other_household])
        session.flush()
        parent = User(
            household_id=household.id,
            email="parent@example.com",
            password_hash="hash",
            role=UserRole.PARENT,
            active=True,
        )
        other_parent = User(
            household_id=household.id,
            email="other-parent@example.com",
            password_hash="hash",
            role=UserRole.PARENT,
            active=True,
        )
        child_one = Child(household_id=household.id, name="Riley", active=True)
        child_two = Child(household_id=household.id, name="Maya", active=True)
        hidden_chore = Chore(
            household_id=other_household.id,
            name="Hidden",
            reward_cents=0,
            start_date=date(2026, 9, 1),
            schedule_mode=ScheduleMode.NONE,
            completion_mode=CompletionMode.PER_CHILD,
            assignment_mode=AssignmentMode.STATIC,
        )
        session.add_all([parent, other_parent, child_one, child_two, hidden_chore])
        session.commit()
        return {
            "household_id": household.id,
            "parent_id": parent.id,
            "other_parent_id": other_parent.id,
            "child_one_id": child_one.id,
            "child_two_id": child_two.id,
            "hidden_chore_id": hidden_chore.id,
        }


def test_chore_management_service_syncs_assignments_without_owning_commit(tmp_path: Path) -> None:
    settings = _settings(f"sqlite:///{tmp_path / 'chore-management.db'}")
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    family = _seed_family(session_factory)

    with session_factory() as session:
        actor = session.get(User, family["parent_id"])
        assert actor is not None
        commit = Mock(side_effect=AssertionError("service must not commit"))
        session.commit = commit

        chore = create_household_chore(
            session,
            CreateChoreRequest(
                household_id=family["household_id"],
                name="Kitchen reset",
                reward_cents=250,
                start_date=date(2026, 9, 1),
                assignment_mode=AssignmentMode.ROTATING,
                rotation_order=[family["child_two_id"], family["child_one_id"]],
            ),
            actor=actor,
        )
        session.flush()
        created = serialize_chore(session, chore)
        assert created.rotation_order == [family["child_two_id"], family["child_one_id"]]
        assert set(created.allowed_child_ids) == {family["child_one_id"], family["child_two_id"]}

        updated_chore = update_household_chore(
            session,
            chore.id,
            UpdateChoreRequest(
                household_id=family["household_id"],
                assignment_mode=AssignmentMode.STATIC,
                allowed_child_ids=[family["child_one_id"]],
            ),
            actor=actor,
        )
        session.flush()
        updated = serialize_chore(session, updated_chore)
        assert updated.assignment_mode == AssignmentMode.STATIC
        assert updated.allowed_child_ids == [family["child_one_id"]]
        assert updated.rotation_order == []
        commit.assert_not_called()


def test_chore_management_service_scopes_protected_lookup_by_household(tmp_path: Path) -> None:
    settings = _settings(f"sqlite:///{tmp_path / 'chore-scope.db'}")
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    family = _seed_family(session_factory)

    with session_factory() as session, pytest.raises(HTTPException) as exc_info:
        get_household_chore_or_404(
            session,
            family["hidden_chore_id"],
            family["household_id"],
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Chore not found."


def test_parent_task_service_enforces_owner_scope_without_owning_commit(tmp_path: Path) -> None:
    settings = _settings(f"sqlite:///{tmp_path / 'parent-task.db'}")
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    family = _seed_family(session_factory)

    with session_factory() as session:
        owner = session.get(User, family["parent_id"])
        other_parent = session.get(User, family["other_parent_id"])
        assert owner is not None
        assert other_parent is not None
        personal_chore = Chore(
            household_id=family["household_id"],
            owner_user_id=owner.id,
            name="Weekly planning",
            reward_cents=0,
            start_date=date(2026, 9, 1),
            schedule_mode=ScheduleMode.NONE,
            completion_mode=CompletionMode.PER_CHILD,
            assignment_mode=AssignmentMode.STATIC,
        )
        session.add(personal_chore)
        session.flush()
        commit = Mock(side_effect=AssertionError("service must not commit"))
        session.commit = commit

        with pytest.raises(HTTPException) as exc_info:
            complete_parent_chore(
                session,
                personal_chore.id,
                date(2026, 9, 1),
                actor=other_parent,
            )
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == "This personal chore belongs to another parent."

        completion = complete_parent_chore(
            session,
            personal_chore.id,
            date(2026, 9, 1),
            actor=owner,
        )
        assert isinstance(completion, ParentChoreCompletion)
        assert completion in session.new
        commit.assert_not_called()
