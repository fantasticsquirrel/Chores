from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_module_access
from app.models.enums import UserRole
from app.models.homeschool import (
    HomeschoolAttendance,
    HomeschoolDayComment,
    HomeschoolGrade,
    HomeschoolSemester,
    HomeschoolSubject,
)
from app.models.identity import User
from app.modules import MODULE_HOMESCHOOL
from app.schemas.homeschool import (
    CreateHomeschoolSemesterRequest,
    CreateHomeschoolSubjectRequest,
    HomeschoolAttendanceResponse,
    HomeschoolDayCommentResponse,
    HomeschoolGradeResponse,
    HomeschoolSemesterResponse,
    HomeschoolSubjectResponse,
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
    list_household_semesters,
    update_household_semester,
)
from app.services.homeschool.subjects import (
    create_household_subject,
    delete_household_subject,
    list_household_subjects,
    update_household_subject,
)

router = APIRouter(prefix="/homeschool", tags=["homeschool"])
_PARENT_ROLES = (UserRole.PARENT_ADMIN, UserRole.PARENT)
_require_homeschool_access = require_module_access(MODULE_HOMESCHOOL, *_PARENT_ROLES)


@router.get("/semesters", response_model=list[HomeschoolSemesterResponse])
def list_semesters(
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> list[HomeschoolSemester]:
    require_household_scope(current_user, household_id)
    return list_household_semesters(session, household_id)


@router.post("/semesters", response_model=HomeschoolSemesterResponse, status_code=status.HTTP_201_CREATED)
def create_semester(
    payload: CreateHomeschoolSemesterRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolSemester:
    require_household_scope(current_user, payload.household_id)
    semester = create_household_semester(session, payload)
    session.commit()
    session.refresh(semester)
    return semester


@router.put("/semesters/{semester_id}", response_model=HomeschoolSemesterResponse)
def update_semester(
    semester_id: int,
    payload: UpdateHomeschoolSemesterRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolSemester:
    require_household_scope(current_user, payload.household_id)
    semester = update_household_semester(session, semester_id, payload)
    session.commit()
    session.refresh(semester)
    return semester


@router.delete("/semesters/{semester_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_semester(
    semester_id: int,
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> None:
    require_household_scope(current_user, household_id)
    delete_household_semester(session, semester_id, household_id)
    session.commit()


@router.get("/subjects", response_model=list[HomeschoolSubjectResponse])
def list_subjects(
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> list[HomeschoolSubject]:
    require_household_scope(current_user, household_id)
    return list_household_subjects(session, household_id)


@router.post("/subjects", response_model=HomeschoolSubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: CreateHomeschoolSubjectRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolSubject:
    require_household_scope(current_user, payload.household_id)
    subject = create_household_subject(session, payload)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Subject already exists.") from exc
    session.refresh(subject)
    return subject


@router.put("/subjects/{subject_id}", response_model=HomeschoolSubjectResponse)
def update_subject(
    subject_id: int,
    payload: UpdateHomeschoolSubjectRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolSubject:
    require_household_scope(current_user, payload.household_id)
    subject = update_household_subject(session, subject_id, payload)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Subject already exists.") from exc
    session.refresh(subject)
    return subject


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: int,
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> None:
    require_household_scope(current_user, household_id)
    delete_household_subject(session, subject_id, household_id)
    session.commit()


@router.get("/attendance", response_model=list[HomeschoolAttendanceResponse])
def list_attendance(
    household_id: int = Query(gt=0),
    child_id: int | None = Query(default=None, gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> list[HomeschoolAttendance]:
    require_household_scope(current_user, household_id)
    return list_household_attendance(session, household_id, child_id)


@router.put("/attendance", response_model=HomeschoolAttendanceResponse)
def upsert_attendance(
    payload: UpsertHomeschoolAttendanceRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolAttendance:
    require_household_scope(current_user, payload.household_id)
    attendance = upsert_household_attendance(session, payload)
    session.commit()
    session.refresh(attendance)
    return attendance


@router.delete("/attendance/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attendance(
    attendance_id: int,
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> None:
    require_household_scope(current_user, household_id)
    delete_household_attendance(session, attendance_id, household_id)
    session.commit()


@router.get("/day-comments", response_model=list[HomeschoolDayCommentResponse])
def list_day_comments(
    household_id: int = Query(gt=0),
    child_id: int | None = Query(default=None, gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> list[HomeschoolDayComment]:
    require_household_scope(current_user, household_id)
    return list_household_day_comments(session, household_id, child_id)


@router.put("/day-comments", response_model=HomeschoolDayCommentResponse)
def upsert_day_comment(
    payload: UpsertHomeschoolDayCommentRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolDayComment:
    require_household_scope(current_user, payload.household_id)
    comment = upsert_household_day_comment(session, payload)
    session.commit()
    session.refresh(comment)
    return comment


@router.delete("/day-comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_day_comment(
    comment_id: int,
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> None:
    require_household_scope(current_user, household_id)
    delete_household_day_comment(session, comment_id, household_id)
    session.commit()


@router.get("/grades", response_model=list[HomeschoolGradeResponse])
def list_grades(
    household_id: int = Query(gt=0),
    child_id: int | None = Query(default=None, gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> list[HomeschoolGrade]:
    require_household_scope(current_user, household_id)
    return list_household_grades(session, household_id, child_id)


@router.put("/grades", response_model=HomeschoolGradeResponse)
def upsert_grade(
    payload: UpsertHomeschoolGradeRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolGrade:
    require_household_scope(current_user, payload.household_id)
    grade = upsert_household_grade(session, payload)
    session.commit()
    session.refresh(grade)
    return grade


@router.delete("/grades/{grade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_grade(
    grade_id: int,
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> None:
    require_household_scope(current_user, household_id)
    delete_household_grade(session, grade_id, household_id)
    session.commit()
