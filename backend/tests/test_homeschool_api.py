from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import Child, Household, User
from app.models.enums import UserRole
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


def test_parent_can_manage_courses_and_assign_students(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        create_response = client.post(
            "/chore-api/homeschool/courses",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "subject_area": "science",
                "grade_level": 4,
                "title": "Earth Science Lab",
                "description": "Rocks, weather, and observation notebooks.",
                "color": "#38d98e",
                "icon": "flask",
                "assigned_child_ids": [child.id],
            },
        )
        assert create_response.status_code == 201
        course_id = create_response.json()["id"]

        list_response = client.get(f"/chore-api/homeschool/courses?household_id={user.household_id}")
        update_response = client.put(
            f"/chore-api/homeschool/courses/{course_id}",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "subject_area": "grammar",
                "grade_level": 4,
                "title": "Sentence Workshop",
                "description": "Parts of speech and sentence revision.",
                "color": "#ff4f9e",
                "icon": "pen",
                "active": True,
                "assigned_child_ids": [child.id],
            },
        )
        archive_response = client.delete(
            f"/chore-api/homeschool/courses/{course_id}?household_id={user.household_id}",
            headers={"X-CSRF-Token": csrf_token},
        )
        active_list_response = client.get(f"/chore-api/homeschool/courses?household_id={user.household_id}")
        archived_list_response = client.get(
            f"/chore-api/homeschool/courses?household_id={user.household_id}&active_only=false"
        )

    assert create_response.json()["assigned_child_ids"] == [child.id]
    assert create_response.json()["subject_area"] == "science"
    assert list_response.status_code == 200
    assert [course["title"] for course in list_response.json()] == ["Earth Science Lab"]
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Sentence Workshop"
    assert update_response.json()["subject_area"] == "grammar"
    assert archive_response.status_code == 204
    assert active_list_response.json() == []
    assert archived_list_response.status_code == 200
    assert archived_list_response.json()[0]["active"] is False
    assert archived_list_response.json()[0]["archived_at"] is not None


def test_parent_can_manage_lessons_and_record_progress_summary(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        course_response = client.post(
            "/chore-api/homeschool/courses",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "subject_area": "vocabulary",
                "grade_level": 3,
                "title": "Word Study",
                "description": "Prefixes, roots, and review.",
                "color": "#7c83ff",
                "icon": "book",
                "assigned_child_ids": [child.id],
            },
        )
        assert course_response.status_code == 201
        course_id = course_response.json()["id"]
        lesson_one_response = client.post(
            f"/chore-api/homeschool/courses/{course_id}/lessons",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "title": "Prefixes re- and un-",
                "overview": "Use prefixes to change word meaning.",
                "sequence_order": 1,
                "estimated_minutes": 20,
                "activity_prompt": "Sort ten words by prefix.",
                "answer_key": "Check prefix meaning and base word.",
            },
        )
        lesson_two_response = client.post(
            f"/chore-api/homeschool/courses/{course_id}/lessons",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "title": "Context Clues",
                "overview": "Use nearby words to infer meaning.",
                "sequence_order": 2,
                "estimated_minutes": 25,
                "activity_prompt": "Underline clues in five sentences.",
                "answer_key": "Answers should cite evidence from the sentence.",
            },
        )
        assert lesson_one_response.status_code == 201
        assert lesson_two_response.status_code == 201
        lesson_one_id = lesson_one_response.json()["id"]
        update_lesson_response = client.put(
            f"/chore-api/homeschool/lessons/{lesson_one_id}",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "title": "Prefixes re-, un-, and pre-",
                "overview": "Use prefixes to change word meaning.",
                "sequence_order": 1,
                "estimated_minutes": 30,
                "activity_prompt": "Sort twelve words by prefix.",
                "answer_key": "Check prefix meaning and base word.",
            },
        )
        progress_response = client.put(
            "/chore-api/homeschool/progress",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "child_id": child.id,
                "lesson_id": lesson_one_id,
                "status": "completed",
                "score_percent": 95,
                "notes": "Ready for the next list.",
            },
        )
        summary_response = client.get(f"/chore-api/homeschool/learning-summary?household_id={user.household_id}")
        progress_list_response = client.get(
            f"/chore-api/homeschool/progress?household_id={user.household_id}&course_id={course_id}&child_id={child.id}"
        )
        archive_lesson_response = client.delete(
            f"/chore-api/homeschool/lessons/{lesson_two_response.json()['id']}?household_id={user.household_id}",
            headers={"X-CSRF-Token": csrf_token},
        )
        lessons_after_archive_response = client.get(
            f"/chore-api/homeschool/courses/{course_id}/lessons?household_id={user.household_id}"
        )

    assert update_lesson_response.status_code == 200
    assert update_lesson_response.json()["title"] == "Prefixes re-, un-, and pre-"
    assert progress_response.status_code == 200
    assert progress_response.json()["status"] == "completed"
    assert progress_response.json()["completed_at"] is not None
    assert progress_response.json()["score_percent"] == 95
    assert progress_list_response.status_code == 200
    assert len(progress_list_response.json()) == 1
    assert summary_response.status_code == 200
    assert summary_response.json()["students"][0]["completion_percent"] == 50
    assert summary_response.json()["courses"][0]["lesson_count"] == 2
    assert summary_response.json()["courses"][0]["completion_percent"] == 50
    assert archive_lesson_response.status_code == 204
    assert [lesson["title"] for lesson in lessons_after_archive_response.json()] == ["Prefixes re-, un-, and pre-"]


def test_progress_rejects_unassigned_student(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, child, password = _create_parent_fixture()
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        unassigned_child = Child(household_id=user.household_id, name="Jordan", active=True)
        session.add(unassigned_child)
        session.commit()
        session.refresh(unassigned_child)
        unassigned_child_id = unassigned_child.id

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        course_response = client.post(
            "/chore-api/homeschool/courses",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "subject_area": "math",
                "grade_level": 2,
                "title": "Math Lab",
                "description": "",
                "color": "#20d3ff",
                "icon": "abacus",
                "assigned_child_ids": [child.id],
            },
        )
        lesson_response = client.post(
            f"/chore-api/homeschool/courses/{course_response.json()['id']}/lessons",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "title": "Add to 100",
                "sequence_order": 1,
            },
        )
        response = client.put(
            "/chore-api/homeschool/progress",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "child_id": unassigned_child_id,
                "lesson_id": lesson_response.json()["id"],
                "status": "in_progress",
            },
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Child is not assigned to this course."


def test_parent_cannot_cross_household_boundaries_for_learning_platform(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        other_household = Household(name="Other Home", timezone="UTC")
        session.add(other_household)
        session.flush()
        other_child = Child(household_id=other_household.id, name="Other Student", active=True)
        session.add(other_child)
        session.commit()
        other_household_id = other_household.id
        other_child_id = other_child.id

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        list_response = client.get(f"/chore-api/homeschool/courses?household_id={other_household_id}")
        create_response = client.post(
            "/chore-api/homeschool/courses",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "subject_area": "science",
                "grade_level": 1,
                "title": "Nature",
                "description": "",
                "color": "#38d98e",
                "icon": "leaf",
                "assigned_child_ids": [other_child_id],
            },
        )

    assert list_response.status_code == 403
    assert create_response.status_code == 404
    assert create_response.json()["detail"] == "Child not found."


def test_child_role_cannot_manage_learning_courses(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, child, _password = _create_parent_fixture()
    child_password = "password123"
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        child_user = User(
            household_id=parent.household_id,
            email="child-learning@example.com",
            password_hash=hash_password(child_password),
            role=UserRole.CHILD,
            child_id=child.id,
        )
        session.add(child_user)
        session.commit()
        session.refresh(child_user)

    with TestClient(app) as client:
        csrf_token = _login(client, child_user, child_password)
        response = client.post(
            "/chore-api/homeschool/courses",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": parent.household_id,
                "subject_area": "math",
                "grade_level": 1,
                "title": "Grade 1 Math",
                "assigned_child_ids": [child.id],
            },
        )

    assert response.status_code == 403


def test_parent_can_list_and_import_builtin_math_curriculum(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        curriculum_response = client.get("/chore-api/homeschool/math-curriculum")
        import_response = client.post(
            "/chore-api/homeschool/math-curriculum/import",
            headers={"X-CSRF-Token": csrf_token},
            json={"household_id": user.household_id, "grade_level": 3, "assigned_child_ids": [child.id]},
        )
        assert import_response.status_code == 201
        course_id = import_response.json()["id"]
        lessons_response = client.get(
            f"/chore-api/homeschool/courses/{course_id}/lessons?household_id={user.household_id}"
        )

    assert curriculum_response.status_code == 200
    assert [course["grade_level"] for course in curriculum_response.json()] == [1, 2, 3, 4, 5]
    assert len(curriculum_response.json()[4]["lessons"]) >= 8
    assert "fractions" in curriculum_response.json()[2]["topics"]
    assert import_response.json()["subject_area"] == "math"
    assert import_response.json()["grade_level"] == 3
    assert import_response.json()["lesson_count"] == len(curriculum_response.json()[2]["lessons"])
    assert import_response.json()["assigned_child_ids"] == [child.id]
    assert lessons_response.status_code == 200
    assert lessons_response.json()[0]["title"] == "Multiplication as Equal Groups"
