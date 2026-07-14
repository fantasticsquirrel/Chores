from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import Household, User
from app.models.enums import UserRole
from app.security import hash_password
from app.services.modules import ModuleService


def _seed_view_only_admin(tmp_path: Path, monkeypatch) -> tuple[User, str]:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'module-manage.db'}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    initialize_database(get_settings())
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        household = Household(name="Home", timezone="UTC")
        session.add(household)
        session.flush()
        admin = User(
            household_id=household.id,
            email="view-only-admin@example.test",
            password_hash=hash_password("password123"),
            role=UserRole.PARENT_ADMIN,
        )
        steward = User(
            household_id=household.id,
            email="managing-admin@example.test",
            password_hash=hash_password("password123"),
            role=UserRole.PARENT_ADMIN,
        )
        session.add_all([admin, steward])
        session.flush()
        service = ModuleService()
        for module_key in ("chores", "recipes", "homeschool", "admin"):
            service.set_user_access(session, admin, module_key, can_view=True, can_manage=False)
        session.commit()
        session.refresh(admin)
        return admin, "password123"


@pytest.mark.parametrize(
    "read_path,write_method,write_path",
    [
        ("/chore-api/chores?household_id=1", "post", "/chore-api/chores"),
        ("/chore-api/children?household_id=1", "post", "/chore-api/children"),
        ("/chore-api/recipes", "post", "/chore-api/recipes/categories"),
        ("/chore-api/homeschool/semesters?household_id=1", "post", "/chore-api/homeschool/semesters"),
        ("/chore-api/modules/users", "put", "/chore-api/modules/users/1"),
        ("/chore-api/submissions", "post", "/chore-api/submissions/1/approve-all"),
    ],
)
def test_view_only_module_access_allows_reads_and_denies_mutations(
    tmp_path: Path,
    monkeypatch,
    read_path: str,
    write_method: str,
    write_path: str,
) -> None:
    user, password = _seed_view_only_admin(tmp_path, monkeypatch)
    with TestClient(app) as client:
        login = client.post("/chore-api/auth/login", json={"email": user.email, "password": password})
        assert login.status_code == 200
        my_modules = client.get("/chore-api/modules/me")
        assert my_modules.status_code == 200
        assert all(module["can_manage"] is False for module in my_modules.json()["modules"])
        assert client.get(read_path).status_code == 200
        response = client.request(
            write_method.upper(),
            write_path,
            headers={"X-CSRF-Token": login.json()["csrf_token"]},
            json={},
        )
    assert response.status_code == 403
    assert response.json()["detail"] == "Module access denied."
