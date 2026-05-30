from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_module_access
from app.models.core import (
    Child,
    HomeschoolAttendance,
    HomeschoolCourse,
    HomeschoolCourseAssignment,
    HomeschoolDayComment,
    HomeschoolGrade,
    HomeschoolLesson,
    HomeschoolLessonProgress,
    HomeschoolSemester,
    HomeschoolSubject,
    User,
)
from app.models.enums import HomeschoolProgressStatus, HomeschoolSubjectArea, UserRole
from app.modules import MODULE_HOMESCHOOL
from app.schemas.homeschool import (
    BuiltInMathCourseResponse,
    CreateHomeschoolSemesterRequest,
    CreateHomeschoolCourseRequest,
    CreateHomeschoolLessonRequest,
    CreateHomeschoolSubjectRequest,
    HomeschoolCourseResponse,
    HomeschoolCourseStudentSummary,
    HomeschoolAttendanceResponse,
    HomeschoolDayCommentResponse,
    HomeschoolGradeResponse,
    HomeschoolLearningSummaryResponse,
    HomeschoolLessonResponse,
    HomeschoolProgressResponse,
    HomeschoolStudentLearningSummary,
    HomeschoolSemesterResponse,
    HomeschoolSubjectResponse,
    ImportBuiltInMathCourseRequest,
    UpdateHomeschoolSemesterRequest,
    UpdateHomeschoolCourseRequest,
    UpdateHomeschoolLessonRequest,
    UpdateHomeschoolSubjectRequest,
    UpsertHomeschoolAttendanceRequest,
    UpsertHomeschoolDayCommentRequest,
    UpsertHomeschoolGradeRequest,
    UpsertHomeschoolProgressRequest,
)
from app.services.homeschool_curriculum import get_builtin_math_course, list_builtin_math_courses

router = APIRouter(prefix="/homeschool", tags=["homeschool"])
_PARENT_ROLES = (UserRole.PARENT_ADMIN, UserRole.PARENT)
_require_homeschool_access = require_module_access(MODULE_HOMESCHOOL, *_PARENT_ROLES)


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


def _ensure_children_in_household(session: Session, child_ids: list[int], household_id: int) -> list[Child]:
    if not child_ids:
        return []
    children = list(session.scalars(select(Child).where(Child.id.in_(child_ids), Child.household_id == household_id)))
    if {child.id for child in children} != set(child_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")
    return children


def _ensure_course_in_household(session: Session, course_id: int, household_id: int) -> HomeschoolCourse:
    course = session.get(HomeschoolCourse, course_id)
    if course is None or course.household_id != household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    return course


def _ensure_lesson_in_household(session: Session, lesson_id: int, household_id: int) -> HomeschoolLesson:
    lesson = session.get(HomeschoolLesson, lesson_id)
    if lesson is None or lesson.household_id != household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")
    return lesson


def _replace_course_assignments(session: Session, course_id: int, child_ids: list[int]) -> None:
    existing = list(
        session.scalars(select(HomeschoolCourseAssignment).where(HomeschoolCourseAssignment.course_id == course_id))
    )
    for assignment in existing:
        session.delete(assignment)
    for child_id in child_ids:
        session.add(HomeschoolCourseAssignment(course_id=course_id, child_id=child_id))


def _build_course_responses(session: Session, courses: list[HomeschoolCourse]) -> list[HomeschoolCourseResponse]:
    if not courses:
        return []

    course_ids = [course.id for course in courses]
    assignments = list(
        session.scalars(
            select(HomeschoolCourseAssignment).where(HomeschoolCourseAssignment.course_id.in_(course_ids))
        )
    )
    lessons = list(
        session.scalars(
            select(HomeschoolLesson).where(
                HomeschoolLesson.course_id.in_(course_ids),
                HomeschoolLesson.archived_at.is_(None),
            )
        )
    )
    progress_records = list(
        session.scalars(
            select(HomeschoolLessonProgress).where(HomeschoolLessonProgress.course_id.in_(course_ids))
        )
    )
    assigned_child_ids = sorted({assignment.child_id for assignment in assignments})
    assigned_children = {
        child.id: child
        for child in session.scalars(select(Child).where(Child.id.in_(assigned_child_ids))) if assigned_child_ids
    }

    assignments_by_course: dict[int, list[int]] = {course_id: [] for course_id in course_ids}
    for assignment in assignments:
        assignments_by_course.setdefault(assignment.course_id, []).append(assignment.child_id)

    lessons_by_course: dict[int, list[HomeschoolLesson]] = {course_id: [] for course_id in course_ids}
    lesson_ids_by_course: dict[int, set[int]] = {course_id: set() for course_id in course_ids}
    for lesson in lessons:
        lessons_by_course.setdefault(lesson.course_id, []).append(lesson)
        lesson_ids_by_course.setdefault(lesson.course_id, set()).add(lesson.id)

    progress_by_course_child: dict[tuple[int, int], list[HomeschoolLessonProgress]] = {}
    for progress in progress_records:
        active_lesson_ids = lesson_ids_by_course.get(progress.course_id, set())
        if progress.lesson_id not in active_lesson_ids:
            continue
        progress_by_course_child.setdefault((progress.course_id, progress.child_id), []).append(progress)

    responses: list[HomeschoolCourseResponse] = []
    for course in courses:
        course_child_ids = sorted(assignments_by_course.get(course.id, []))
        lesson_count = len(lessons_by_course.get(course.id, []))
        student_summaries: list[HomeschoolCourseStudentSummary] = []
        total_completed = 0
        total_in_progress = 0
        total_needs_review = 0

        for child_id in course_child_ids:
            child_progress = progress_by_course_child.get((course.id, child_id), [])
            completed_count = sum(1 for item in child_progress if item.status == HomeschoolProgressStatus.COMPLETED)
            in_progress_count = sum(1 for item in child_progress if item.status == HomeschoolProgressStatus.IN_PROGRESS)
            needs_review_count = sum(1 for item in child_progress if item.status == HomeschoolProgressStatus.NEEDS_REVIEW)
            total_completed += completed_count
            total_in_progress += in_progress_count
            total_needs_review += needs_review_count
            child = assigned_children.get(child_id)
            student_summaries.append(
                HomeschoolCourseStudentSummary(
                    child_id=child_id,
                    child_name=child.name if child is not None else "Unknown student",
                    lesson_count=lesson_count,
                    completed_count=completed_count,
                    in_progress_count=in_progress_count,
                    needs_review_count=needs_review_count,
                    completion_percent=_percent(completed_count, lesson_count),
                )
            )

        overall_denominator = lesson_count * len(course_child_ids)
        responses.append(
            HomeschoolCourseResponse(
                id=course.id,
                household_id=course.household_id,
                subject_area=course.subject_area,
                grade_level=course.grade_level,
                title=course.title,
                description=course.description,
                color=course.color,
                icon=course.icon,
                active=course.active,
                archived_at=course.archived_at,
                assigned_child_ids=course_child_ids,
                lesson_count=lesson_count,
                completed_count=total_completed,
                in_progress_count=total_in_progress,
                needs_review_count=total_needs_review,
                completion_percent=_percent(total_completed, overall_denominator),
                student_summaries=student_summaries,
            )
        )
    return responses


def _build_learning_summary(session: Session, household_id: int) -> HomeschoolLearningSummaryResponse:
    children = list(session.scalars(select(Child).where(Child.household_id == household_id).order_by(Child.name)))
    courses = list(
        session.scalars(
            select(HomeschoolCourse)
            .where(HomeschoolCourse.household_id == household_id, HomeschoolCourse.archived_at.is_(None))
            .order_by(HomeschoolCourse.grade_level, HomeschoolCourse.title)
        )
    )
    course_responses = _build_course_responses(session, courses)
    progress_records = list(
        session.scalars(
            select(HomeschoolLessonProgress)
            .where(HomeschoolLessonProgress.household_id == household_id)
            .order_by(HomeschoolLessonProgress.id.desc())
        )
    )
    assignments = list(
        session.scalars(
            select(HomeschoolCourseAssignment).where(
                HomeschoolCourseAssignment.course_id.in_([course.id for course in courses])
            )
        )
    )
    lessons_by_course = {
        course.id: course.lesson_count
        for course in course_responses
    }
    assigned_courses_by_child: dict[int, set[int]] = {}
    for assignment in assignments:
        assigned_courses_by_child.setdefault(assignment.child_id, set()).add(assignment.course_id)

    progress_by_child = _active_progress_by_child(progress_records, courses, session)
    student_summaries: list[HomeschoolStudentLearningSummary] = []
    for child in children:
        assigned_courses = assigned_courses_by_child.get(child.id, set())
        lesson_count = sum(lessons_by_course.get(course_id, 0) for course_id in assigned_courses)
        child_progress = progress_by_child.get(child.id, [])
        completed_count = sum(1 for item in child_progress if item.status == HomeschoolProgressStatus.COMPLETED)
        needs_review_count = sum(1 for item in child_progress if item.status == HomeschoolProgressStatus.NEEDS_REVIEW)
        student_summaries.append(
            HomeschoolStudentLearningSummary(
                child_id=child.id,
                child_name=child.name,
                active=child.active,
                assigned_course_count=len(assigned_courses),
                lesson_count=lesson_count,
                completed_count=completed_count,
                needs_review_count=needs_review_count,
                completion_percent=_percent(completed_count, lesson_count),
            )
        )

    return HomeschoolLearningSummaryResponse(
        students=student_summaries,
        courses=course_responses,
        progress_records=[HomeschoolProgressResponse.model_validate(record) for record in progress_records],
    )


def _active_progress_by_child(
    progress_records: list[HomeschoolLessonProgress],
    courses: list[HomeschoolCourse],
    session: Session,
) -> dict[int, list[HomeschoolLessonProgress]]:
    course_ids = [course.id for course in courses]
    active_lesson_ids = set(
        session.scalars(
            select(HomeschoolLesson.id).where(
                HomeschoolLesson.course_id.in_(course_ids),
                HomeschoolLesson.archived_at.is_(None),
            )
        )
    )
    by_child: dict[int, list[HomeschoolLessonProgress]] = {}
    for progress in progress_records:
        if progress.lesson_id in active_lesson_ids:
            by_child.setdefault(progress.child_id, []).append(progress)
    return by_child


def _percent(numerator: int, denominator: int) -> int:
    if denominator <= 0:
        return 0
    return round((numerator / denominator) * 100)


@router.get("/semesters", response_model=list[HomeschoolSemesterResponse])
def list_semesters(
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
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
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolSemester:
    _ensure_household_access(current_user, payload.household_id)
    semester = HomeschoolSemester(**payload.model_dump())
    session.add(semester)
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
    _ensure_household_access(current_user, payload.household_id)
    semester = session.get(HomeschoolSemester, semester_id)
    if semester is None or semester.household_id != payload.household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found.")
    semester.name = payload.name
    semester.start_date = payload.start_date
    semester.end_date = payload.end_date
    semester.active = payload.active
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
    _ensure_household_access(current_user, household_id)
    semester = session.get(HomeschoolSemester, semester_id)
    if semester is None or semester.household_id != household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found.")
    has_grades = session.scalar(
        select(HomeschoolGrade.id).where(
            HomeschoolGrade.household_id == household_id,
            HomeschoolGrade.semester_id == semester_id,
        ).limit(1)
    ) is not None
    if has_grades:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Semester has grades. Clear related grades first.")
    session.delete(semester)
    session.commit()


@router.get("/subjects", response_model=list[HomeschoolSubjectResponse])
def list_subjects(
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
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
    current_user: User = Depends(_require_homeschool_access),
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


@router.put("/subjects/{subject_id}", response_model=HomeschoolSubjectResponse)
def update_subject(
    subject_id: int,
    payload: UpdateHomeschoolSubjectRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolSubject:
    _ensure_household_access(current_user, payload.household_id)
    subject = session.get(HomeschoolSubject, subject_id)
    if subject is None or subject.household_id != payload.household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")
    subject.name = payload.name
    subject.color = payload.color
    subject.active = payload.active
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
    _ensure_household_access(current_user, household_id)
    subject = session.get(HomeschoolSubject, subject_id)
    if subject is None or subject.household_id != household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")
    has_attendance = session.scalar(
        select(HomeschoolAttendance.id).where(
            HomeschoolAttendance.household_id == household_id,
            HomeschoolAttendance.subject_id == subject_id,
        ).limit(1)
    ) is not None
    has_grades = session.scalar(
        select(HomeschoolGrade.id).where(
            HomeschoolGrade.household_id == household_id,
            HomeschoolGrade.subject_id == subject_id,
        ).limit(1)
    ) is not None
    if has_attendance or has_grades:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Subject has homeschool records. Clear related attendance and grades first.")
    session.delete(subject)
    session.commit()


@router.get("/attendance", response_model=list[HomeschoolAttendanceResponse])
def list_attendance(
    household_id: int = Query(gt=0),
    child_id: int | None = Query(default=None, gt=0),
    current_user: User = Depends(_require_homeschool_access),
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
    current_user: User = Depends(_require_homeschool_access),
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
    current_user: User = Depends(_require_homeschool_access),
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
    current_user: User = Depends(_require_homeschool_access),
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
    current_user: User = Depends(_require_homeschool_access),
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


@router.delete("/day-comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_day_comment(
    comment_id: int,
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> None:
    _ensure_household_access(current_user, household_id)
    comment = session.get(HomeschoolDayComment, comment_id)
    if comment is None or comment.household_id != household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Day comment not found.")
    session.delete(comment)
    session.commit()


@router.get("/grades", response_model=list[HomeschoolGradeResponse])
def list_grades(
    household_id: int = Query(gt=0),
    child_id: int | None = Query(default=None, gt=0),
    current_user: User = Depends(_require_homeschool_access),
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
    current_user: User = Depends(_require_homeschool_access),
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


@router.delete("/grades/{grade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_grade(
    grade_id: int,
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> None:
    _ensure_household_access(current_user, household_id)
    grade = session.get(HomeschoolGrade, grade_id)
    if grade is None or grade.household_id != household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade not found.")
    session.delete(grade)
    session.commit()


@router.get("/learning-summary", response_model=HomeschoolLearningSummaryResponse)
def get_learning_summary(
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolLearningSummaryResponse:
    _ensure_household_access(current_user, household_id)
    return _build_learning_summary(session, household_id)


@router.get("/courses", response_model=list[HomeschoolCourseResponse])
def list_courses(
    household_id: int = Query(gt=0),
    subject_area: HomeschoolSubjectArea | None = Query(default=None),
    active_only: bool = True,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> list[HomeschoolCourseResponse]:
    _ensure_household_access(current_user, household_id)
    stmt = select(HomeschoolCourse).where(HomeschoolCourse.household_id == household_id)
    if active_only:
        stmt = stmt.where(HomeschoolCourse.archived_at.is_(None), HomeschoolCourse.active.is_(True))
    if subject_area is not None:
        stmt = stmt.where(HomeschoolCourse.subject_area == subject_area)
    courses = list(session.scalars(stmt.order_by(HomeschoolCourse.grade_level, HomeschoolCourse.title)))
    return _build_course_responses(session, courses)


@router.post("/courses", response_model=HomeschoolCourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CreateHomeschoolCourseRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolCourseResponse:
    _ensure_household_access(current_user, payload.household_id)
    _ensure_children_in_household(session, payload.assigned_child_ids, payload.household_id)
    course = HomeschoolCourse(
        household_id=payload.household_id,
        subject_area=payload.subject_area,
        grade_level=payload.grade_level,
        title=payload.title,
        description=payload.description,
        color=payload.color,
        icon=payload.icon,
        active=payload.active,
    )
    session.add(course)
    session.flush()
    _replace_course_assignments(session, course.id, payload.assigned_child_ids)
    session.commit()
    session.refresh(course)
    return _build_course_responses(session, [course])[0]


@router.put("/courses/{course_id}", response_model=HomeschoolCourseResponse)
def update_course(
    course_id: int,
    payload: UpdateHomeschoolCourseRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolCourseResponse:
    _ensure_household_access(current_user, payload.household_id)
    course = _ensure_course_in_household(session, course_id, payload.household_id)
    _ensure_children_in_household(session, payload.assigned_child_ids, payload.household_id)
    course.subject_area = payload.subject_area
    course.grade_level = payload.grade_level
    course.title = payload.title
    course.description = payload.description
    course.color = payload.color
    course.icon = payload.icon
    course.active = payload.active
    if payload.active:
        course.archived_at = None
    _replace_course_assignments(session, course.id, payload.assigned_child_ids)
    session.commit()
    session.refresh(course)
    return _build_course_responses(session, [course])[0]


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_course(
    course_id: int,
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> None:
    _ensure_household_access(current_user, household_id)
    course = _ensure_course_in_household(session, course_id, household_id)
    course.active = False
    course.archived_at = datetime.now(UTC)
    session.commit()


@router.get("/courses/{course_id}/lessons", response_model=list[HomeschoolLessonResponse])
def list_lessons(
    course_id: int,
    household_id: int = Query(gt=0),
    active_only: bool = True,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> list[HomeschoolLesson]:
    _ensure_household_access(current_user, household_id)
    _ensure_course_in_household(session, course_id, household_id)
    stmt = select(HomeschoolLesson).where(HomeschoolLesson.household_id == household_id, HomeschoolLesson.course_id == course_id)
    if active_only:
        stmt = stmt.where(HomeschoolLesson.archived_at.is_(None))
    return list(session.scalars(stmt.order_by(HomeschoolLesson.sequence_order, HomeschoolLesson.id)))


@router.post("/courses/{course_id}/lessons", response_model=HomeschoolLessonResponse, status_code=status.HTTP_201_CREATED)
def create_lesson(
    course_id: int,
    payload: CreateHomeschoolLessonRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolLesson:
    _ensure_household_access(current_user, payload.household_id)
    _ensure_course_in_household(session, course_id, payload.household_id)
    lesson = HomeschoolLesson(course_id=course_id, **payload.model_dump())
    session.add(lesson)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lesson sequence already exists for this course.") from exc
    session.refresh(lesson)
    return lesson


@router.put("/lessons/{lesson_id}", response_model=HomeschoolLessonResponse)
def update_lesson(
    lesson_id: int,
    payload: UpdateHomeschoolLessonRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolLesson:
    _ensure_household_access(current_user, payload.household_id)
    lesson = _ensure_lesson_in_household(session, lesson_id, payload.household_id)
    lesson.title = payload.title
    lesson.overview = payload.overview
    lesson.sequence_order = payload.sequence_order
    lesson.estimated_minutes = payload.estimated_minutes
    lesson.activity_prompt = payload.activity_prompt
    lesson.answer_key = payload.answer_key
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lesson sequence already exists for this course.") from exc
    session.refresh(lesson)
    return lesson


@router.delete("/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_lesson(
    lesson_id: int,
    household_id: int = Query(gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> None:
    _ensure_household_access(current_user, household_id)
    lesson = _ensure_lesson_in_household(session, lesson_id, household_id)
    lesson.archived_at = datetime.now(UTC)
    session.commit()


@router.get("/progress", response_model=list[HomeschoolProgressResponse])
def list_progress(
    household_id: int = Query(gt=0),
    course_id: int | None = Query(default=None, gt=0),
    child_id: int | None = Query(default=None, gt=0),
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> list[HomeschoolLessonProgress]:
    _ensure_household_access(current_user, household_id)
    stmt = select(HomeschoolLessonProgress).where(HomeschoolLessonProgress.household_id == household_id)
    if course_id is not None:
        _ensure_course_in_household(session, course_id, household_id)
        stmt = stmt.where(HomeschoolLessonProgress.course_id == course_id)
    if child_id is not None:
        _ensure_child_in_household(session, child_id, household_id)
        stmt = stmt.where(HomeschoolLessonProgress.child_id == child_id)
    return list(session.scalars(stmt.order_by(HomeschoolLessonProgress.id.desc())))


@router.put("/progress", response_model=HomeschoolProgressResponse)
def upsert_progress(
    payload: UpsertHomeschoolProgressRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolLessonProgress:
    _ensure_household_access(current_user, payload.household_id)
    _ensure_child_in_household(session, payload.child_id, payload.household_id)
    lesson = _ensure_lesson_in_household(session, payload.lesson_id, payload.household_id)
    course = _ensure_course_in_household(session, lesson.course_id, payload.household_id)
    assignment_exists = session.get(
        HomeschoolCourseAssignment,
        {"course_id": course.id, "child_id": payload.child_id},
    )
    if assignment_exists is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Child is not assigned to this course.")

    completed_at = payload.completed_at
    if payload.status == HomeschoolProgressStatus.COMPLETED and completed_at is None:
        completed_at = datetime.now(UTC)
    if payload.status != HomeschoolProgressStatus.COMPLETED:
        completed_at = None

    progress = session.scalar(
        select(HomeschoolLessonProgress).where(
            HomeschoolLessonProgress.child_id == payload.child_id,
            HomeschoolLessonProgress.lesson_id == payload.lesson_id,
        )
    )
    if progress is None:
        progress = HomeschoolLessonProgress(
            household_id=payload.household_id,
            child_id=payload.child_id,
            course_id=course.id,
            lesson_id=payload.lesson_id,
            status=payload.status,
            score_percent=payload.score_percent,
            completed_at=completed_at,
            notes=payload.notes,
        )
        session.add(progress)
    else:
        progress.status = payload.status
        progress.score_percent = payload.score_percent
        progress.completed_at = completed_at
        progress.notes = payload.notes
    session.commit()
    session.refresh(progress)
    return progress


@router.get("/math-curriculum", response_model=list[BuiltInMathCourseResponse])
def list_math_curriculum(
    current_user: User = Depends(_require_homeschool_access),
) -> list[dict]:
    _ = current_user
    return list_builtin_math_courses()


@router.post("/math-curriculum/import", response_model=HomeschoolCourseResponse, status_code=status.HTTP_201_CREATED)
def import_math_curriculum(
    payload: ImportBuiltInMathCourseRequest,
    current_user: User = Depends(_require_homeschool_access),
    session: Session = Depends(get_db_session),
) -> HomeschoolCourseResponse:
    _ensure_household_access(current_user, payload.household_id)
    _ensure_children_in_household(session, payload.assigned_child_ids, payload.household_id)
    built_in_course = get_builtin_math_course(payload.grade_level)
    if built_in_course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Math curriculum not found.")

    course = HomeschoolCourse(
        household_id=payload.household_id,
        subject_area=HomeschoolSubjectArea.MATH,
        grade_level=built_in_course["grade_level"],
        title=built_in_course["title"],
        description=built_in_course["description"],
        color=built_in_course["color"],
        icon=built_in_course["icon"],
        active=True,
    )
    session.add(course)
    session.flush()
    _replace_course_assignments(session, course.id, payload.assigned_child_ids)
    for lesson_payload in built_in_course["lessons"]:
        session.add(
            HomeschoolLesson(
                household_id=payload.household_id,
                course_id=course.id,
                title=lesson_payload["title"],
                overview=lesson_payload["overview"],
                sequence_order=lesson_payload["sequence_order"],
                estimated_minutes=lesson_payload["estimated_minutes"],
                activity_prompt=lesson_payload["activity_prompt"],
                answer_key=lesson_payload["answer_key"],
            )
        )
    session.commit()
    session.refresh(course)
    return _build_course_responses(session, [course])[0]
