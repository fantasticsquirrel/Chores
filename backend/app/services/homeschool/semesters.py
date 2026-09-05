"""Household-scoped semester CRUD operations."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.homeschool import HomeschoolGrade, HomeschoolSemester
from app.schemas.homeschool import CreateHomeschoolSemesterRequest, UpdateHomeschoolSemesterRequest
from app.services.homeschool.access import get_household_semester_or_404


def list_household_semesters(session: Session, household_id: int) -> list[HomeschoolSemester]:
    return list(
        session.scalars(
            select(HomeschoolSemester)
            .where(HomeschoolSemester.household_id == household_id)
            .order_by(HomeschoolSemester.start_date.desc(), HomeschoolSemester.id.desc())
        )
    )


def create_household_semester(
    session: Session,
    payload: CreateHomeschoolSemesterRequest,
) -> HomeschoolSemester:
    semester = HomeschoolSemester(**payload.model_dump())
    session.add(semester)
    return semester


def update_household_semester(
    session: Session,
    semester_id: int,
    payload: UpdateHomeschoolSemesterRequest,
) -> HomeschoolSemester:
    semester = get_household_semester_or_404(session, semester_id, payload.household_id)
    assert semester is not None
    semester.name = payload.name
    semester.start_date = payload.start_date
    semester.end_date = payload.end_date
    semester.active = payload.active
    return semester


def delete_household_semester(session: Session, semester_id: int, household_id: int) -> None:
    semester = get_household_semester_or_404(session, semester_id, household_id)
    assert semester is not None
    has_grades = session.scalar(
        select(HomeschoolGrade.id)
        .where(
            HomeschoolGrade.household_id == household_id,
            HomeschoolGrade.semester_id == semester_id,
        )
        .limit(1)
    ) is not None
    if has_grades:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Semester has grades. Clear related grades first.",
        )
    session.delete(semester)
