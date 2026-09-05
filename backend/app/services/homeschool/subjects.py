"""Household-scoped subject CRUD operations."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.homeschool import HomeschoolAttendance, HomeschoolGrade, HomeschoolSubject
from app.schemas.homeschool import CreateHomeschoolSubjectRequest, UpdateHomeschoolSubjectRequest
from app.services.homeschool.access import get_household_subject_or_404


def list_household_subjects(session: Session, household_id: int) -> list[HomeschoolSubject]:
    return list(
        session.scalars(
            select(HomeschoolSubject)
            .where(HomeschoolSubject.household_id == household_id)
            .order_by(HomeschoolSubject.name)
        )
    )


def create_household_subject(
    session: Session,
    payload: CreateHomeschoolSubjectRequest,
) -> HomeschoolSubject:
    subject = HomeschoolSubject(**payload.model_dump())
    session.add(subject)
    return subject


def update_household_subject(
    session: Session,
    subject_id: int,
    payload: UpdateHomeschoolSubjectRequest,
) -> HomeschoolSubject:
    subject = get_household_subject_or_404(session, subject_id, payload.household_id)
    subject.name = payload.name
    subject.color = payload.color
    subject.active = payload.active
    return subject


def delete_household_subject(session: Session, subject_id: int, household_id: int) -> None:
    subject = get_household_subject_or_404(session, subject_id, household_id)
    has_attendance = session.scalar(
        select(HomeschoolAttendance.id)
        .where(
            HomeschoolAttendance.household_id == household_id,
            HomeschoolAttendance.subject_id == subject_id,
        )
        .limit(1)
    ) is not None
    has_grades = session.scalar(
        select(HomeschoolGrade.id)
        .where(
            HomeschoolGrade.household_id == household_id,
            HomeschoolGrade.subject_id == subject_id,
        )
        .limit(1)
    ) is not None
    if has_attendance or has_grades:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject has homeschool records. Clear related attendance and grades first.",
        )
    session.delete(subject)
