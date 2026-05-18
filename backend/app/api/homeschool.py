from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_roles
from app.models.core import Child, HomeschoolAttendance, HomeschoolDayComment, HomeschoolGrade, HomeschoolSemester, HomeschoolSubject, User
from app.models.enums import UserRole
from app.schemas.homeschool import (
    CreateHomeschoolSemesterRequest,
    CreateHomeschoolSubjectRequest,
    HomeschoolAttendanceResponse,
    HomeschoolDayCommentResponse,
    HomeschoolGradeResponse,
    HomeschoolSemesterResponse,
    HomeschoolSubjectResponse,
    UpsertHomeschoolAttendanceRequest,
    UpsertHomeschoolDayCommentRequest,
    UpsertHomeschoolGradeRequest,
)

router = APIRouter(prefix="/homeschool", tags=["homeschool"])
_PARENT_ROLES = (UserRole.PARENT_ADMIN, UserRole.PARENT)


def _ensure_household_access(user: User, household_id: int) -> None:
    if user.household_id != household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")


def _ensure_child_in_household(session: Session, child_id: int, household_id: int) -> None:
    child = session.get(Child, child_id)
    if child is None or child.household_id != household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")


def _ensure_subject_in_household(session: Session, subject_id: int, household_id: int) -> None:
    subject = session.get(HomeschoolSubject, subject_id)
    if subject is None or subject.household_id != household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")


def _ensure_semester_in_household(session: Session, semester_id: int | None, household_id: int) -> None:
    if semester_id is None:
        return
    semester = session.get(HomeschoolSemester, semester_id)
    if semester is None or semester.household_id != household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found.")


@router.get("/semesters", response_model=list[HomeschoolSemesterResponse])
def list_semesters(
    household_id: int = Query(gt=0),
    current_user: User = Depends(require_roles(*_PARENT_ROLES)),
    session: Session = Depends(get_db_session),
) -> list[HomeschoolSemester]:
    _ensure_household_access(current_user, household_id)
    return list(
        session.scalars(
            select(HomeschoolSemester)
            .where(HomeschoolSemester.household_id == household_id)
            .order_by(HomeschoolSemester.start_date.desc(), HomeschoolSemester.id.desc())
        )
    )


@router.post("/semesters", response_model=HomeschoolSemesterResponse, status_code=status.HTTP_201_CREATED)
def create_semester(
    payload: CreateHomeschoolSemesterRequest,
    current_user: User = Depends(require_roles(*_PARENT_ROLES)),
    session: Session = Depends(get_db_session),
) -> HomeschoolSemester:
    _ensure_household_access(current_user, payload.household_id)
    semester = HomeschoolSemester(**payload.model_dump())
    session.add(semester)
    session.commit()
    session.refresh(semester)
    return semester


@router.get("/subjects", response_model=list[HomeschoolSubjectResponse])
def list_subjects(
    household_id: int = Query(gt=0),
    current_user: User = Depends(require_roles(*_PARENT_ROLES)),
    session: Session = Depends(get_db_session),
) -> list[HomeschoolSubject]:
    _ensure_household_access(current_user, household_id)
    return list(
        session.scalars(
            select(HomeschoolSubject)
            .where(HomeschoolSubject.household_id == household_id)
            .order_by(HomeschoolSubject.name)
        )
    )


@router.post("/subjects", response_model=HomeschoolSubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: CreateHomeschoolSubjectRequest,
    current_user: User = Depends(require_roles(*_PARENT_ROLES)),
    session: Session = Depends(get_db_session),
) -> HomeschoolSubject:
    _ensure_household_access(current_user, payload.household_id)
    subject = HomeschoolSubject(**payload.model_dump())
    session.add(subject)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Subject already exists.") from exc
    session.refresh(subject)
    return subject


@router.get("/attendance", response_model=list[HomeschoolAttendanceResponse])
def list_attendance(
    household_id: int = Query(gt=0),
    child_id: int | None = Query(default=None, gt=0),
    current_user: User = Depends(require_roles(*_PARENT_ROLES)),
    session: Session = Depends(get_db_session),
) -> list[HomeschoolAttendance]:
    _ensure_household_access(current_user, household_id)
    stmt = select(HomeschoolAttendance).where(HomeschoolAttendance.household_id == household_id)
    if child_id is not None:
        _ensure_child_in_household(session, child_id, household_id)
        stmt = stmt.where(HomeschoolAttendance.child_id == child_id)
    return list(session.scalars(stmt.order_by(HomeschoolAttendance.date.desc(), HomeschoolAttendance.id.desc())))


@router.put("/attendance", response_model=HomeschoolAttendanceResponse)
def upsert_attendance(
    payload: UpsertHomeschoolAttendanceRequest,
    current_user: User = Depends(require_roles(*_PARENT_ROLES)),
    session: Session = Depends(get_db_session),
) -> HomeschoolAttendance:
    _ensure_household_access(current_user, payload.household_id)
    _ensure_child_in_household(session, payload.child_id, payload.household_id)
    _ensure_subject_in_household(session, payload.subject_id, payload.household_id)

    attendance = session.scalar(
        select(HomeschoolAttendance).where(
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
    session.commit()
    session.refresh(attendance)
    return attendance


@router.delete("/attendance/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attendance(
    attendance_id: int,
    household_id: int = Query(gt=0),
    current_user: User = Depends(require_roles(*_PARENT_ROLES)),
    session: Session = Depends(get_db_session),
) -> None:
    _ensure_household_access(current_user, household_id)
    attendance = session.get(HomeschoolAttendance, attendance_id)
    if attendance is None or attendance.household_id != household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance not found.")
    session.delete(attendance)
    session.commit()


@router.get("/day-comments", response_model=list[HomeschoolDayCommentResponse])
def list_day_comments(
    household_id: int = Query(gt=0),
    child_id: int | None = Query(default=None, gt=0),
    current_user: User = Depends(require_roles(*_PARENT_ROLES)),
    session: Session = Depends(get_db_session),
) -> list[HomeschoolDayComment]:
    _ensure_household_access(current_user, household_id)
    stmt = select(HomeschoolDayComment).where(HomeschoolDayComment.household_id == household_id)
    if child_id is not None:
        _ensure_child_in_household(session, child_id, household_id)
        stmt = stmt.where(HomeschoolDayComment.child_id == child_id)
    return list(session.scalars(stmt.order_by(HomeschoolDayComment.date.desc(), HomeschoolDayComment.id.desc())))


@router.put("/day-comments", response_model=HomeschoolDayCommentResponse)
def upsert_day_comment(
    payload: UpsertHomeschoolDayCommentRequest,
    current_user: User = Depends(require_roles(*_PARENT_ROLES)),
    session: Session = Depends(get_db_session),
) -> HomeschoolDayComment:
    _ensure_household_access(current_user, payload.household_id)
    _ensure_child_in_household(session, payload.child_id, payload.household_id)

    comment = session.scalar(
        select(HomeschoolDayComment).where(
            HomeschoolDayComment.child_id == payload.child_id,
            HomeschoolDayComment.date == payload.date,
        )
    )
    if comment is None:
        comment = HomeschoolDayComment(**payload.model_dump())
        session.add(comment)
    else:
        comment.comment = payload.comment
    session.commit()
    session.refresh(comment)
    return comment


@router.get("/grades", response_model=list[HomeschoolGradeResponse])
def list_grades(
    household_id: int = Query(gt=0),
    child_id: int | None = Query(default=None, gt=0),
    current_user: User = Depends(require_roles(*_PARENT_ROLES)),
    session: Session = Depends(get_db_session),
) -> list[HomeschoolGrade]:
    _ensure_household_access(current_user, household_id)
    stmt = select(HomeschoolGrade).where(HomeschoolGrade.household_id == household_id)
    if child_id is not None:
        _ensure_child_in_household(session, child_id, household_id)
        stmt = stmt.where(HomeschoolGrade.child_id == child_id)
    return list(session.scalars(stmt.order_by(HomeschoolGrade.id.desc())))


@router.put("/grades", response_model=HomeschoolGradeResponse)
def upsert_grade(
    payload: UpsertHomeschoolGradeRequest,
    current_user: User = Depends(require_roles(*_PARENT_ROLES)),
    session: Session = Depends(get_db_session),
) -> HomeschoolGrade:
    _ensure_household_access(current_user, payload.household_id)
    _ensure_child_in_household(session, payload.child_id, payload.household_id)
    _ensure_subject_in_household(session, payload.subject_id, payload.household_id)
    _ensure_semester_in_household(session, payload.semester_id, payload.household_id)

    grade = session.scalar(
        select(HomeschoolGrade).where(
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
    session.commit()
    session.refresh(grade)
    return grade
