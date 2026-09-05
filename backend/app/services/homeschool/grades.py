"""Household-scoped grade CRUD operations."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.homeschool import HomeschoolGrade
from app.schemas.homeschool import UpsertHomeschoolGradeRequest
from app.services.homeschool.access import (
    get_household_child_or_404,
    get_household_semester_or_404,
    get_household_subject_or_404,
)


def list_household_grades(
    session: Session,
    household_id: int,
    child_id: int | None = None,
) -> list[HomeschoolGrade]:
    stmt = select(HomeschoolGrade).where(HomeschoolGrade.household_id == household_id)
    if child_id is not None:
        get_household_child_or_404(session, child_id, household_id)
        stmt = stmt.where(HomeschoolGrade.child_id == child_id)
    return list(session.scalars(stmt.order_by(HomeschoolGrade.id.desc())))


def upsert_household_grade(
    session: Session,
    payload: UpsertHomeschoolGradeRequest,
) -> HomeschoolGrade:
    get_household_child_or_404(session, payload.child_id, payload.household_id)
    get_household_subject_or_404(session, payload.subject_id, payload.household_id)
    get_household_semester_or_404(session, payload.semester_id, payload.household_id)
    grade = session.scalar(
        select(HomeschoolGrade).where(
            HomeschoolGrade.household_id == payload.household_id,
            HomeschoolGrade.child_id == payload.child_id,
            HomeschoolGrade.subject_id == payload.subject_id,
            HomeschoolGrade.semester_id == payload.semester_id,
        )
    )
    if grade is None:
        grade = HomeschoolGrade(**payload.model_dump())
        session.add(grade)
    else:
        grade.grade = payload.grade
    return grade


def delete_household_grade(session: Session, grade_id: int, household_id: int) -> None:
    grade = session.scalar(
        select(HomeschoolGrade).where(
            HomeschoolGrade.id == grade_id,
            HomeschoolGrade.household_id == household_id,
        )
    )
    if grade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade not found.")
    session.delete(grade)
