"""Household-scoped attendance CRUD operations."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.homeschool import HomeschoolAttendance
from app.schemas.homeschool import UpsertHomeschoolAttendanceRequest
from app.services.homeschool.access import get_household_child_or_404, get_household_subject_or_404


def list_household_attendance(
    session: Session,
    household_id: int,
    child_id: int | None = None,
) -> list[HomeschoolAttendance]:
    stmt = select(HomeschoolAttendance).where(HomeschoolAttendance.household_id == household_id)
    if child_id is not None:
        get_household_child_or_404(session, child_id, household_id)
        stmt = stmt.where(HomeschoolAttendance.child_id == child_id)
    return list(session.scalars(stmt.order_by(HomeschoolAttendance.date.desc(), HomeschoolAttendance.id.desc())))


def upsert_household_attendance(
    session: Session,
    payload: UpsertHomeschoolAttendanceRequest,
) -> HomeschoolAttendance:
    get_household_child_or_404(session, payload.child_id, payload.household_id)
    get_household_subject_or_404(session, payload.subject_id, payload.household_id)
    attendance = session.scalar(
        select(HomeschoolAttendance).where(
            HomeschoolAttendance.household_id == payload.household_id,
            HomeschoolAttendance.child_id == payload.child_id,
            HomeschoolAttendance.subject_id == payload.subject_id,
            HomeschoolAttendance.date == payload.date,
        )
    )
    if attendance is None:
        attendance = HomeschoolAttendance(**payload.model_dump())
        session.add(attendance)
    else:
        attendance.present = payload.present
        attendance.comment = payload.comment
    return attendance


def delete_household_attendance(session: Session, attendance_id: int, household_id: int) -> None:
    attendance = session.scalar(
        select(HomeschoolAttendance).where(
            HomeschoolAttendance.id == attendance_id,
            HomeschoolAttendance.household_id == household_id,
        )
    )
    if attendance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance not found.")
    session.delete(attendance)
