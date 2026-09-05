from __future__ import annotations

from datetime import date
from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.config import Settings
from app.db import get_session_factory, initialize_database
from app.models.enums import UserRole
from app.models.homeschool import HomeschoolSemester, HomeschoolSubject
from app.models.identity import Child, Household, User
from app.schemas.homeschool import (
    CreateHomeschoolSemesterRequest,
    CreateHomeschoolSubjectRequest,
    UpdateHomeschoolSemesterRequest,
    UpdateHomeschoolSubjectRequest,
    UpsertHomeschoolAttendanceRequest,
    UpsertHomeschoolDayCommentRequest,
    UpsertHomeschoolGradeRequest,
)
from app.services.homeschool.access import require_household_scope
from app.services.homeschool.attendance import (
    delete_household_attendance,
    list_household_attendance,
    upsert_household_attendance,
)
from app.services.homeschool.day_comments import (
    delete_household_day_comment,
    list_household_day_comments,
    upsert_household_day_comment,
)
from app.services.homeschool.grades import delete_household_grade, list_household_grades, upsert_household_grade
from app.services.homeschool.semesters import (
    create_household_semester,
    delete_household_semester,
    update_household_semester,
)
from app.services.homeschool.subjects import (
    create_household_subject,
    delete_household_subject,
    update_household_subject,
)


def _settings(database_url: str) -> Settings:
    return Settings(
        app_env="test",
        database_url=database_url,
        secret_key="a" * 32,
        log_level="INFO",
        session_cookie_secure=False,
    )


def _seed_households(session_factory) -> dict[str, int]:
    with session_factory() as session:
        household = Household(name="Home", timezone="UTC")
        other_household = Household(name="Other home", timezone="UTC")
        session.add_all([household, other_household])
        session.flush()
        actor = User(
            household_id=household.id,
            email="parent@example.com",
            password_hash="hash",
            role=UserRole.PARENT,
            active=True,
        )
        child = Child(household_id=household.id, name="Riley", active=True)
        other_child = Child(household_id=other_household.id, name="Jordan", active=True)
        hidden_semester = HomeschoolSemester(
            household_id=other_household.id,
            name="Hidden semester",
            start_date=date(2026, 8, 15),
            end_date=date(2026, 12, 20),
        )
        hidden_subject = HomeschoolSubject(
            household_id=other_household.id,
            name="Hidden subject",
            color="#111827",
        )
        session.add_all([actor, child, other_child, hidden_semester, hidden_subject])
        session.commit()
        return {
            "household_id": household.id,
            "other_household_id": other_household.id,
            "actor_id": actor.id,
            "child_id": child.id,
            "other_child_id": other_child.id,
            "hidden_semester_id": hidden_semester.id,
            "hidden_subject_id": hidden_subject.id,
        }


def test_homeschool_access_and_crud_lookups_preserve_household_scope(tmp_path: Path) -> None:
    settings = _settings(f"sqlite:///{tmp_path / 'homeschool-scope.db'}")
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    family = _seed_households(session_factory)

    with session_factory() as session:
        actor = session.get(User, family["actor_id"])
        assert actor is not None

        with pytest.raises(HTTPException) as household_error:
            require_household_scope(actor, family["other_household_id"])
        assert household_error.value.status_code == 403
        assert household_error.value.detail == "Forbidden."

        with pytest.raises(HTTPException) as child_error:
            list_household_attendance(session, family["household_id"], family["other_child_id"])
        assert child_error.value.status_code == 404
        assert child_error.value.detail == "Child not found."

        with pytest.raises(HTTPException) as semester_error:
            update_household_semester(
                session,
                family["hidden_semester_id"],
                UpdateHomeschoolSemesterRequest(
                    household_id=family["household_id"],
                    name="Still hidden",
                    start_date=date(2026, 8, 15),
                    end_date=date(2026, 12, 20),
                ),
            )
        assert semester_error.value.status_code == 404
        assert semester_error.value.detail == "Semester not found."

        with pytest.raises(HTTPException) as subject_error:
            update_household_subject(
                session,
                family["hidden_subject_id"],
                UpdateHomeschoolSubjectRequest(
                    household_id=family["household_id"],
                    name="Still hidden",
                    color="#111827",
                ),
            )
        assert subject_error.value.status_code == 404
        assert subject_error.value.detail == "Subject not found."


def test_homeschool_crud_services_mutate_without_owning_transactions(tmp_path: Path) -> None:
    settings = _settings(f"sqlite:///{tmp_path / 'homeschool-crud.db'}")
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    family = _seed_households(session_factory)

    with session_factory() as session:
        commit = Mock(side_effect=AssertionError("service must not commit"))
        session.commit = commit
        semester = create_household_semester(
            session,
            CreateHomeschoolSemesterRequest(
                household_id=family["household_id"],
                name="Fall 2026",
                start_date=date(2026, 8, 15),
                end_date=date(2026, 12, 20),
            ),
        )
        subject = create_household_subject(
            session,
            CreateHomeschoolSubjectRequest(
                household_id=family["household_id"],
                name="Math",
                color="#ef4444",
            ),
        )
        session.flush()

        update_household_semester(
            session,
            semester.id,
            UpdateHomeschoolSemesterRequest(
                household_id=family["household_id"],
                name="Spring 2027",
                start_date=date(2027, 1, 10),
                end_date=date(2027, 5, 20),
            ),
        )
        update_household_subject(
            session,
            subject.id,
            UpdateHomeschoolSubjectRequest(
                household_id=family["household_id"],
                name="Mathematics",
                color="#3b82f6",
            ),
        )
        attendance = upsert_household_attendance(
            session,
            UpsertHomeschoolAttendanceRequest(
                household_id=family["household_id"],
                child_id=family["child_id"],
                subject_id=subject.id,
                date=date(2026, 9, 1),
                present=True,
                comment="Fractions",
            ),
        )
        day_comment = upsert_household_day_comment(
            session,
            UpsertHomeschoolDayCommentRequest(
                household_id=family["household_id"],
                child_id=family["child_id"],
                date=date(2026, 9, 1),
                comment="Good day",
            ),
        )
        grade = upsert_household_grade(
            session,
            UpsertHomeschoolGradeRequest(
                household_id=family["household_id"],
                child_id=family["child_id"],
                subject_id=subject.id,
                semester_id=semester.id,
                grade="A",
            ),
        )
        session.flush()

        updated_attendance = upsert_household_attendance(
            session,
            UpsertHomeschoolAttendanceRequest(
                household_id=family["household_id"],
                child_id=family["child_id"],
                subject_id=subject.id,
                date=date(2026, 9, 1),
                present=False,
                comment="Sick day",
            ),
        )
        updated_comment = upsert_household_day_comment(
            session,
            UpsertHomeschoolDayCommentRequest(
                household_id=family["household_id"],
                child_id=family["child_id"],
                date=date(2026, 9, 1),
                comment="Rest day",
            ),
        )
        updated_grade = upsert_household_grade(
            session,
            UpsertHomeschoolGradeRequest(
                household_id=family["household_id"],
                child_id=family["child_id"],
                subject_id=subject.id,
                semester_id=semester.id,
                grade="B+",
            ),
        )

        assert updated_attendance.id == attendance.id
        assert updated_attendance.present is False
        assert updated_attendance.comment == "Sick day"
        assert updated_comment.id == day_comment.id
        assert updated_comment.comment == "Rest day"
        assert updated_grade.id == grade.id
        assert updated_grade.grade == "B+"
        assert list_household_attendance(session, family["household_id"], family["child_id"]) == [attendance]
        assert list_household_day_comments(session, family["household_id"], family["child_id"]) == [day_comment]
        assert list_household_grades(session, family["household_id"], family["child_id"]) == [grade]

        delete_household_attendance(session, attendance.id, family["household_id"])
        delete_household_day_comment(session, day_comment.id, family["household_id"])
        delete_household_grade(session, grade.id, family["household_id"])
        session.flush()
        delete_household_subject(session, subject.id, family["household_id"])
        delete_household_semester(session, semester.id, family["household_id"])
        commit.assert_not_called()
