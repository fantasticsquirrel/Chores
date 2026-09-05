from __future__ import annotations

from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import Child, Household, User
from app.models.enums import UserRole
from app.models.homeschool import (
    HomeschoolAttendance,
    HomeschoolDayComment,
    HomeschoolGrade,
    HomeschoolSemester,
    HomeschoolSubject,
)
from app.security import hash_password
from app.services.modules import ModuleService


def _configure_test_settings(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "homeschool_api.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()


def _create_parent_fixture(password: str = "password123") -> tuple[User, Child, str]:
    settings = get_settings()
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        household = Household(name="Home", timezone="UTC")
        session.add(household)
        session.flush()
        child = Child(household_id=household.id, name="Avery", active=True)
        session.add(child)
        session.flush()
        user = User(
            household_id=household.id,
            email="parent@example.com",
            password_hash=hash_password(password),
            role=UserRole.PARENT_ADMIN,
            child_id=None,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        session.refresh(child)
        return user, child, password


def _login(client: TestClient, user: User, password: str) -> str:
    response = client.post("/chore-api/auth/login", json={"email": user.email, "password": password})
    assert response.status_code == 200
    token = response.json()["csrf_token"]
    assert token
    return token


def test_parent_can_create_and_list_homeschool_semester(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        create_response = client.post(
            "/chore-api/homeschool/semesters",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "name": "Fall 2026",
                "start_date": "2026-08-15",
                "end_date": "2026-12-20",
            },
        )
        list_response = client.get(f"/chore-api/homeschool/semesters?household_id={user.household_id}")

    assert create_response.status_code == 201
    assert create_response.json()["name"] == "Fall 2026"
    assert list_response.status_code == 200
    assert [row["name"] for row in list_response.json()] == ["Fall 2026"]


def test_parent_can_create_subject_and_upsert_attendance(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        subject_response = client.post(
            "/chore-api/homeschool/subjects",
            headers={"X-CSRF-Token": csrf_token},
            json={"household_id": user.household_id, "name": "Math", "color": "#ef4444"},
        )
        assert subject_response.status_code == 201
        subject_id = subject_response.json()["id"]

        attendance_response = client.put(
            "/chore-api/homeschool/attendance",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "child_id": child.id,
                "subject_id": subject_id,
                "date": "2026-09-01",
                "present": True,
                "comment": "Fractions",
            },
        )
        list_response = client.get(
            f"/chore-api/homeschool/attendance?household_id={user.household_id}&child_id={child.id}"
        )

    assert attendance_response.status_code == 200
    assert attendance_response.json()["comment"] == "Fractions"
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["subject_id"] == subject_id


def test_child_role_cannot_access_parent_homeschool_endpoints(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, child, _password = _create_parent_fixture()
    child_password = "password123"
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        child_user = User(
            household_id=parent.household_id,
            email="child@example.com",
            password_hash=hash_password(child_password),
            role=UserRole.CHILD,
            child_id=child.id,
        )
        session.add(child_user)
        session.commit()
        session.refresh(child_user)

    with TestClient(app) as client:
        _login(client, child_user, child_password)
        response = client.get(f"/chore-api/homeschool/semesters?household_id={parent.household_id}")

    assert response.status_code == 403


def test_parent_can_upsert_day_comment_and_grade(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        subject_response = client.post(
            "/chore-api/homeschool/subjects",
            headers={"X-CSRF-Token": csrf_token},
            json={"household_id": user.household_id, "name": "Reading", "color": "#3b82f6"},
        )
        assert subject_response.status_code == 201
        subject_id = subject_response.json()["id"]

        comment_response = client.put(
            "/chore-api/homeschool/day-comments",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "child_id": child.id,
                "date": "2026-09-02",
                "comment": "Read two chapters aloud.",
            },
        )
        grade_response = client.put(
            "/chore-api/homeschool/grades",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "child_id": child.id,
                "subject_id": subject_id,
                "grade": "A",
            },
        )
        comments_list = client.get(
            f"/chore-api/homeschool/day-comments?household_id={user.household_id}&child_id={child.id}"
        )
        grades_list = client.get(f"/chore-api/homeschool/grades?household_id={user.household_id}&child_id={child.id}")

    assert comment_response.status_code == 200
    assert comment_response.json()["comment"] == "Read two chapters aloud."
    assert grade_response.status_code == 200
    assert grade_response.json()["grade"] == "A"
    assert comments_list.status_code == 200
    assert len(comments_list.json()) == 1
    assert grades_list.status_code == 200
    assert len(grades_list.json()) == 1



def test_parent_can_update_semester_and_subject(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        semester_response = client.post(
            "/chore-api/homeschool/semesters",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "name": "Fall 2026",
                "start_date": "2026-08-15",
                "end_date": "2026-12-20",
            },
        )
        subject_response = client.post(
            "/chore-api/homeschool/subjects",
            headers={"X-CSRF-Token": csrf_token},
            json={"household_id": user.household_id, "name": "Math", "color": "#ef4444"},
        )
        assert semester_response.status_code == 201
        assert subject_response.status_code == 201

        update_semester_response = client.put(
            f"/chore-api/homeschool/semesters/{semester_response.json()['id']}",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "name": "Spring 2027",
                "start_date": "2027-01-10",
                "end_date": "2027-05-20",
                "active": True,
            },
        )
        update_subject_response = client.put(
            f"/chore-api/homeschool/subjects/{subject_response.json()['id']}",
            headers={"X-CSRF-Token": csrf_token},
            json={"household_id": user.household_id, "name": "Reading", "color": "#3b82f6", "active": True},
        )

    assert update_semester_response.status_code == 200
    assert update_semester_response.json()["name"] == "Spring 2027"
    assert update_semester_response.json()["start_date"] == "2027-01-10"
    assert update_subject_response.status_code == 200
    assert update_subject_response.json()["name"] == "Reading"
    assert update_subject_response.json()["color"] == "#3b82f6"


def test_parent_cannot_update_other_household_homeschool_setup(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        response = client.put(
            "/chore-api/homeschool/subjects/999",
            headers={"X-CSRF-Token": csrf_token},
            json={"household_id": user.household_id + 1, "name": "Reading", "color": "#3b82f6"},
        )

    assert response.status_code == 403


def test_parent_can_delete_attendance_entry(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        subject_response = client.post(
            "/chore-api/homeschool/subjects",
            headers={"X-CSRF-Token": csrf_token},
            json={"household_id": user.household_id, "name": "Math", "color": "#ef4444"},
        )
        assert subject_response.status_code == 201
        attendance_response = client.put(
            "/chore-api/homeschool/attendance",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "child_id": child.id,
                "subject_id": subject_response.json()["id"],
                "date": "2026-09-01",
                "present": True,
                "comment": "Fractions",
            },
        )
        assert attendance_response.status_code == 200
        attendance_id = attendance_response.json()["id"]

        delete_response = client.delete(
            f"/chore-api/homeschool/attendance/{attendance_id}?household_id={user.household_id}",
            headers={"X-CSRF-Token": csrf_token},
        )
        list_response = client.get(
            f"/chore-api/homeschool/attendance?household_id={user.household_id}&child_id={child.id}"
        )

    assert delete_response.status_code == 204
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_parent_cannot_delete_other_household_attendance(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        response = client.delete(
            f"/chore-api/homeschool/attendance/999?household_id={user.household_id + 1}",
            headers={"X-CSRF-Token": csrf_token},
        )

    assert response.status_code == 403


def test_parent_can_delete_day_comment(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        comment_response = client.put(
            "/chore-api/homeschool/day-comments",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "child_id": child.id,
                "date": "2026-09-01",
                "comment": "Field trip",
            },
        )
        assert comment_response.status_code == 200
        comment_id = comment_response.json()["id"]

        delete_response = client.delete(
            f"/chore-api/homeschool/day-comments/{comment_id}?household_id={user.household_id}",
            headers={"X-CSRF-Token": csrf_token},
        )
        list_response = client.get(
            f"/chore-api/homeschool/day-comments?household_id={user.household_id}&child_id={child.id}"
        )

    assert delete_response.status_code == 204
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_parent_cannot_delete_other_household_day_comment(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        response = client.delete(
            f"/chore-api/homeschool/day-comments/999?household_id={user.household_id + 1}",
            headers={"X-CSRF-Token": csrf_token},
        )

    assert response.status_code == 403


def test_parent_can_delete_grade(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        subject_response = client.post(
            "/chore-api/homeschool/subjects",
            headers={"X-CSRF-Token": csrf_token},
            json={"household_id": user.household_id, "name": "Math", "color": "#ef4444"},
        )
        assert subject_response.status_code == 201
        grade_response = client.put(
            "/chore-api/homeschool/grades",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "child_id": child.id,
                "subject_id": subject_response.json()["id"],
                "semester_id": None,
                "grade": "A",
            },
        )
        assert grade_response.status_code == 200
        grade_id = grade_response.json()["id"]

        delete_response = client.delete(
            f"/chore-api/homeschool/grades/{grade_id}?household_id={user.household_id}",
            headers={"X-CSRF-Token": csrf_token},
        )
        list_response = client.get(
            f"/chore-api/homeschool/grades?household_id={user.household_id}&child_id={child.id}"
        )

    assert delete_response.status_code == 204
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_parent_cannot_delete_other_household_grade(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        response = client.delete(
            f"/chore-api/homeschool/grades/999?household_id={user.household_id + 1}",
            headers={"X-CSRF-Token": csrf_token},
        )

    assert response.status_code == 403


def test_parent_can_delete_semester(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        create_response = client.post(
            "/chore-api/homeschool/semesters",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "name": "Fall 2026",
                "start_date": "2026-08-15",
                "end_date": "2026-12-20",
            },
        )
        assert create_response.status_code == 201
        semester_id = create_response.json()["id"]

        delete_response = client.delete(
            f"/chore-api/homeschool/semesters/{semester_id}?household_id={user.household_id}",
            headers={"X-CSRF-Token": csrf_token},
        )
        list_response = client.get(f"/chore-api/homeschool/semesters?household_id={user.household_id}")

    assert delete_response.status_code == 204
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_parent_cannot_delete_other_household_semester(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        response = client.delete(
            f"/chore-api/homeschool/semesters/999?household_id={user.household_id + 1}",
            headers={"X-CSRF-Token": csrf_token},
        )

    assert response.status_code == 403


def test_parent_can_delete_subject(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        create_response = client.post(
            "/chore-api/homeschool/subjects",
            headers={"X-CSRF-Token": csrf_token},
            json={"household_id": user.household_id, "name": "Math", "color": "#ef4444"},
        )
        assert create_response.status_code == 201
        subject_id = create_response.json()["id"]

        delete_response = client.delete(
            f"/chore-api/homeschool/subjects/{subject_id}?household_id={user.household_id}",
            headers={"X-CSRF-Token": csrf_token},
        )
        list_response = client.get(f"/chore-api/homeschool/subjects?household_id={user.household_id}")

    assert delete_response.status_code == 204
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_parent_cannot_delete_other_household_subject(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        response = client.delete(
            f"/chore-api/homeschool/subjects/999?household_id={user.household_id + 1}",
            headers={"X-CSRF-Token": csrf_token},
        )

    assert response.status_code == 403

def test_parent_cannot_delete_semester_with_grades(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        semester_response = client.post(
            "/chore-api/homeschool/semesters",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "name": "Fall 2026",
                "start_date": "2026-08-15",
                "end_date": "2026-12-20",
            },
        )
        subject_response = client.post(
            "/chore-api/homeschool/subjects",
            headers={"X-CSRF-Token": csrf_token},
            json={"household_id": user.household_id, "name": "Math", "color": "#ef4444"},
        )
        assert semester_response.status_code == 201
        assert subject_response.status_code == 201
        grade_response = client.put(
            "/chore-api/homeschool/grades",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "child_id": child.id,
                "subject_id": subject_response.json()["id"],
                "semester_id": semester_response.json()["id"],
                "grade": "A",
            },
        )
        assert grade_response.status_code == 200

        delete_response = client.delete(
            f"/chore-api/homeschool/semesters/{semester_response.json()['id']}?household_id={user.household_id}",
            headers={"X-CSRF-Token": csrf_token},
        )

    assert delete_response.status_code == 400
    assert delete_response.json()["detail"] == "Semester has grades. Clear related grades first."


def test_parent_cannot_delete_subject_with_records(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        subject_response = client.post(
            "/chore-api/homeschool/subjects",
            headers={"X-CSRF-Token": csrf_token},
            json={"household_id": user.household_id, "name": "Math", "color": "#ef4444"},
        )
        assert subject_response.status_code == 201
        attendance_response = client.put(
            "/chore-api/homeschool/attendance",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "child_id": child.id,
                "subject_id": subject_response.json()["id"],
                "date": "2026-09-01",
                "present": True,
                "comment": "Fractions",
            },
        )
        assert attendance_response.status_code == 200

        delete_response = client.delete(
            f"/chore-api/homeschool/subjects/{subject_response.json()['id']}?household_id={user.household_id}",
            headers={"X-CSRF-Token": csrf_token},
        )

    assert delete_response.status_code == 400
    assert delete_response.json()["detail"] == "Subject has homeschool records. Clear related attendance and grades first."


def test_parent_without_homeschool_module_access_is_forbidden(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()

    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        db_user = session.get(User, user.id)
        assert db_user is not None
        ModuleService().set_user_access(session, target_user=db_user, module_key="homeschool", can_view=False)
        session.commit()

    with TestClient(app) as client:
        _login(client, user, password)
        response = client.get(f"/chore-api/homeschool/semesters?household_id={user.household_id}")

    assert response.status_code == 403
    assert response.json()["detail"] == "Module access denied."


def test_parent_cannot_list_homeschool_records_for_another_households_child(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        other_household = Household(name="Other home", timezone="UTC")
        session.add(other_household)
        session.flush()
        other_child = Child(household_id=other_household.id, name="Jordan", active=True)
        session.add(other_child)
        session.commit()
        other_child_id = other_child.id

    with TestClient(app) as client:
        _login(client, user, password)
        responses = [
            client.get(
                f"/chore-api/homeschool/{record_type}"
                f"?household_id={user.household_id}&child_id={other_child_id}"
            )
            for record_type in ("attendance", "day-comments", "grades")
        ]

    assert [(response.status_code, response.json()["detail"]) for response in responses] == [
        (404, "Child not found."),
        (404, "Child not found."),
        (404, "Child not found."),
    ]


def test_parent_cannot_mutate_another_households_homeschool_resources(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        other_household = Household(name="Other home", timezone="UTC")
        session.add(other_household)
        session.flush()
        other_child = Child(household_id=other_household.id, name="Jordan", active=True)
        other_semester = HomeschoolSemester(
            household_id=other_household.id,
            name="Hidden semester",
            start_date=date(2026, 8, 15),
            end_date=date(2026, 12, 20),
        )
        other_subject = HomeschoolSubject(
            household_id=other_household.id,
            name="Hidden subject",
            color="#111827",
        )
        session.add_all([other_child, other_semester, other_subject])
        session.flush()
        other_attendance = HomeschoolAttendance(
            household_id=other_household.id,
            child_id=other_child.id,
            subject_id=other_subject.id,
            date=date(2026, 9, 1),
            present=True,
            comment="Hidden",
        )
        other_comment = HomeschoolDayComment(
            household_id=other_household.id,
            child_id=other_child.id,
            date=date(2026, 9, 1),
            comment="Hidden",
        )
        other_grade = HomeschoolGrade(
            household_id=other_household.id,
            child_id=other_child.id,
            subject_id=other_subject.id,
            semester_id=other_semester.id,
            grade="A",
        )
        session.add_all([other_attendance, other_comment, other_grade])
        session.commit()
        resource_ids = {
            "semester": other_semester.id,
            "subject": other_subject.id,
            "attendance": other_attendance.id,
            "comment": other_comment.id,
            "grade": other_grade.id,
        }

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        headers = {"X-CSRF-Token": csrf_token}
        responses = [
            client.put(
                f"/chore-api/homeschool/semesters/{resource_ids['semester']}",
                headers=headers,
                json={
                    "household_id": user.household_id,
                    "name": "Still hidden",
                    "start_date": "2026-08-15",
                    "end_date": "2026-12-20",
                    "active": True,
                },
            ),
            client.put(
                f"/chore-api/homeschool/subjects/{resource_ids['subject']}",
                headers=headers,
                json={
                    "household_id": user.household_id,
                    "name": "Still hidden",
                    "color": "#111827",
                    "active": True,
                },
            ),
            client.delete(
                f"/chore-api/homeschool/attendance/{resource_ids['attendance']}"
                f"?household_id={user.household_id}",
                headers=headers,
            ),
            client.delete(
                f"/chore-api/homeschool/day-comments/{resource_ids['comment']}"
                f"?household_id={user.household_id}",
                headers=headers,
            ),
            client.delete(
                f"/chore-api/homeschool/grades/{resource_ids['grade']}"
                f"?household_id={user.household_id}",
                headers=headers,
            ),
        ]

    assert [(response.status_code, response.json()["detail"]) for response in responses] == [
        (404, "Semester not found."),
        (404, "Subject not found."),
        (404, "Attendance not found."),
        (404, "Day comment not found."),
        (404, "Grade not found."),
    ]
