"""Authorization-adjacent household scope checks for homeschool resources."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.homeschool import HomeschoolSemester, HomeschoolSubject
from app.models.identity import Child, User


def require_household_scope(actor: User, household_id: int) -> None:
    """Reject a requested household that differs from the authenticated actor."""
    if actor.household_id != household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")


def get_household_child_or_404(session: Session, child_id: int, household_id: int) -> Child:
    child = session.scalar(select(Child).where(Child.id == child_id, Child.household_id == household_id))
    if child is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")
    return child


def get_household_subject_or_404(
    session: Session,
    subject_id: int,
    household_id: int,
) -> HomeschoolSubject:
    subject = session.scalar(
        select(HomeschoolSubject).where(
            HomeschoolSubject.id == subject_id,
            HomeschoolSubject.household_id == household_id,
        )
    )
    if subject is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")
    return subject


def get_household_semester_or_404(
    session: Session,
    semester_id: int | None,
    household_id: int,
) -> HomeschoolSemester | None:
    if semester_id is None:
        return None
    semester = session.scalar(
        select(HomeschoolSemester).where(
            HomeschoolSemester.id == semester_id,
            HomeschoolSemester.household_id == household_id,
        )
    )
    if semester is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found.")
    return semester
