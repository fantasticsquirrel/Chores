from datetime import date
from io import BytesIO

from fastapi.testclient import TestClient
from pypdf import PdfReader

from app.config import get_settings
from app.db import get_session_factory
from app.main import app
from app.models import Child
from app.models.homeschool import (
    HomeschoolAttendance,
    HomeschoolDayComment,
    HomeschoolGrade,
    HomeschoolSemester,
    HomeschoolSubject,
)
from test_homeschool_api import _configure_test_settings, _create_parent_fixture, _login


def seed_report(tmp_path, monkeypatch):
    _configure_test_settings(tmp_path, monkeypatch)
    user, child, password = _create_parent_fixture()
    with get_session_factory(get_settings().database_url)() as session:
        semester = HomeschoolSemester(
            household_id=user.household_id,
            name="Fall 2026",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
        )
        subject = HomeschoolSubject(
            household_id=user.household_id, name="Mathématiques", color="#123456"
        )
        second = HomeschoolSubject(
            household_id=user.household_id, name="Reading", color="#345678"
        )
        other = Child(household_id=user.household_id, name="Other child", active=True)
        session.add_all([semester, subject, second, other])
        session.flush()
        for sid, day, present, note in [
            (subject.id, "2026-09-01", True, "First private note"),
            (second.id, "2026-09-01", True, ""),
            (subject.id, "2026-09-30", False, "Absent private note"),
            (subject.id, "2026-08-31", True, "Before range"),
            (subject.id, "2026-10-01", True, "After range"),
        ]:
            session.add(
                HomeschoolAttendance(
                    household_id=user.household_id,
                    child_id=child.id,
                    subject_id=sid,
                    date=date.fromisoformat(day),
                    present=present,
                    comment=note,
                )
            )
        session.add(
            HomeschoolAttendance(
                household_id=user.household_id,
                child_id=other.id,
                subject_id=subject.id,
                date=date(2026, 9, 2),
                present=True,
                comment="Other child private",
            )
        )
        session.add(
            HomeschoolDayComment(
                household_id=user.household_id,
                child_id=child.id,
                date=date(2026, 9, 30),
                comment="Day private note",
            )
        )
        session.add(
            HomeschoolGrade(
                household_id=user.household_id,
                child_id=child.id,
                subject_id=subject.id,
                semester_id=semester.id,
                grade="A−",
            )
        )
        session.add(
            HomeschoolGrade(
                household_id=user.household_id,
                child_id=child.id,
                subject_id=second.id,
                semester_id=None,
                grade="Overall only",
            )
        )
        session.commit()
        return user, child, password, semester.id, other.id


def text_of(response):
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "private, no-store"
    return "\n".join(
        page.extract_text() for page in PdfReader(BytesIO(response.content)).pages
    )


def test_report_scoped_inclusive_notes_opt_in(tmp_path, monkeypatch):
    user, child, password, semester_id, _ = seed_report(tmp_path, monkeypatch)
    url = f"/chore-api/homeschool/semesters/{semester_id}/report.pdf"
    params = {"household_id": user.household_id, "child_id": child.id}
    with TestClient(app) as client:
        _login(client, user, password)
        text = text_of(client.get(url, params=params))
        assert "Mathématiques" in text and "A−" in text
        assert (
            "1 distinct attendance day" in text
            and "2 present subject entries" in text
            and "1 absent subject entry" in text
        )
        assert (
            "private" not in text and "Notes" not in text and "Overall only" not in text
        )
        text = text_of(client.get(url, params={**params, "include_notes": True}))
        assert all(
            note in text
            for note in [
                "First private note",
                "Absent private note",
                "Day private note",
            ]
        )
        assert all(
            note not in text
            for note in ["Other child private", "Before range", "After range"]
        )


def test_report_authorization(tmp_path, monkeypatch):
    user, child, password, semester_id, _ = seed_report(tmp_path, monkeypatch)
    url = f"/chore-api/homeschool/semesters/{semester_id}/report.pdf"
    params = {"household_id": user.household_id, "child_id": child.id}
    with TestClient(app) as client:
        assert client.get(url, params=params).status_code == 401
        _login(client, user, password)
        assert (
            client.get(url, params={**params, "household_id": 99999}).status_code == 403
        )
        assert client.get(url, params={**params, "child_id": 99999}).status_code == 404
        assert (
            client.get(
                "/chore-api/homeschool/semesters/99999/report.pdf", params=params
            ).status_code
            == 404
        )


def test_no_grades_long_unicode_notes_paginate(tmp_path, monkeypatch):
    user, child, password, semester_id, other_id = seed_report(tmp_path, monkeypatch)
    with get_session_factory(get_settings().database_url)() as session:
        for day in range(1, 20):
            session.add(
                HomeschoolDayComment(
                    household_id=user.household_id,
                    child_id=other_id,
                    date=date(2026, 9, day),
                    comment="Élodie practised Ελληνικά and Привет. <b>Literal text</b> & notes. "
                    * 40,
                )
            )
        session.commit()
    with TestClient(app) as client:
        _login(client, user, password)
        response = client.get(
            f"/chore-api/homeschool/semesters/{semester_id}/report.pdf",
            params={
                "household_id": user.household_id,
                "child_id": other_id,
                "include_notes": True,
            },
        )
        text = text_of(response)
        assert "Grades" not in text
        assert all(
            word in text
            for word in ["Élodie", "Ελληνικά", "Привет", "<b>Literal text</b>"]
        )
        assert len(PdfReader(BytesIO(response.content)).pages) > 2


def test_report_module_and_child_role_restrictions(tmp_path, monkeypatch):
    from app.models import User
    from app.models.enums import UserRole
    from app.services.modules import ModuleService
    from app.security import hash_password

    user, child, password, semester_id, _ = seed_report(tmp_path, monkeypatch)
    params = {"household_id": user.household_id, "child_id": child.id}
    url = f"/chore-api/homeschool/semesters/{semester_id}/report.pdf"
    factory = get_session_factory(get_settings().database_url)
    with TestClient(app) as client:
        _login(client, user, password)
        with factory() as session:
            ModuleService().set_household_access(
                session,
                household_id=user.household_id,
                module_key="homeschool",
                enabled=False,
            )
            session.commit()
        assert client.get(url, params=params).status_code == 403
        with factory() as session:
            ModuleService().set_household_access(
                session,
                household_id=user.household_id,
                module_key="homeschool",
                enabled=True,
            )
            child_user = User(
                household_id=user.household_id,
                email="report-child@example.test",
                password_hash=hash_password(password),
                role=UserRole.CHILD,
                child_id=child.id,
            )
            session.add(child_user)
            session.commit()
            session.refresh(child_user)
        _login(client, child_user, password)
        assert client.get(url, params=params).status_code == 403


def test_report_existing_other_household_resources_are_not_disclosed(
    tmp_path, monkeypatch
):
    from household_fixtures import household_with_owner

    user, child, password, semester_id, _ = seed_report(tmp_path, monkeypatch)
    with get_session_factory(get_settings().database_url)() as session:
        other = household_with_owner(session, name="Other household", timezone="UTC")
        session.add(other)
        session.flush()
        other_child = Child(household_id=other.id, name="Secret child", active=True)
        other_semester = HomeschoolSemester(
            household_id=other.id,
            name="Secret semester",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )
        session.add_all([other_child, other_semester])
        session.commit()
        other_child_id, other_semester_id = other_child.id, other_semester.id
    with TestClient(app) as client:
        _login(client, user, password)
        assert (
            client.get(
                f"/chore-api/homeschool/semesters/{semester_id}/report.pdf",
                params={"household_id": user.household_id, "child_id": other_child_id},
            ).status_code
            == 404
        )
        assert (
            client.get(
                f"/chore-api/homeschool/semesters/{other_semester_id}/report.pdf",
                params={"household_id": user.household_id, "child_id": child.id},
            ).status_code
            == 404
        )


def test_unsupported_glyphs_are_explicit_not_silent_boxes(tmp_path, monkeypatch):
    user, child, password, semester_id, _ = seed_report(tmp_path, monkeypatch)
    with get_session_factory(get_settings().database_url)() as session:
        session.get(Child, child.id).name = "Élodie 中文 🧑"
        session.commit()
    with TestClient(app) as client:
        _login(client, user, password)
        text = text_of(
            client.get(
                f"/chore-api/homeschool/semesters/{semester_id}/report.pdf",
                params={"household_id": user.household_id, "child_id": child.id},
            )
        )
        assert "Élodie [U+4E2D][U+6587] [U+1F9D1]" in text
        assert "Characters unavailable in the report font" in text


def test_empty_semester_has_no_empty_grade_or_notes_section(tmp_path, monkeypatch):
    user, child, password, _, _ = seed_report(tmp_path, monkeypatch)
    with get_session_factory(get_settings().database_url)() as session:
        semester = HomeschoolSemester(
            household_id=user.household_id,
            name="Empty semester",
            start_date=date(2027, 1, 1),
            end_date=date(2027, 6, 30),
        )
        session.add(semester)
        session.commit()
        semester_id = semester.id
    with TestClient(app) as client:
        _login(client, user, password)
        response = client.get(
            f"/chore-api/homeschool/semesters/{semester_id}/report.pdf",
            params={
                "household_id": user.household_id,
                "child_id": child.id,
                "include_notes": True,
            },
        )
        text = text_of(response)
        assert "0 distinct attendance days" in text and "No attendance recorded" in text
        assert "Grades" not in text and "Notes" not in text
        assert len(PdfReader(BytesIO(response.content)).pages) == 1
