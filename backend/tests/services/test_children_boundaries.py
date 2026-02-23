from __future__ import annotations

from pathlib import Path

from app.config import Settings
from app.db import get_session_factory, initialize_database
from app.models.core import Child, Household
from app.repositories.children import ChildRepository
from app.services.children import ChildService


class _FakeChildRepository:
    def __init__(self, session: object) -> None:
        self.session = session
        self.calls: list[tuple[str, tuple[object, ...], dict[str, object]]] = []

    def list_by_household(self, household_id: int, *, active_only: bool = False) -> list[Child]:
        self.calls.append(("list_by_household", (household_id,), {"active_only": active_only}))
        return [Child(household_id=household_id, name="Demo", active=True)]

    def add(self, child: Child) -> Child:
        self.calls.append(("add", (child,), {}))
        return child

    def get_by_id(self, household_id: int, child_id: int) -> Child | None:
        self.calls.append(("get_by_id", (household_id, child_id), {}))
        return Child(id=child_id, household_id=household_id, name="Found", active=True)

    def update(self, child: Child, *, name: str | None = None, active: bool | None = None) -> Child:
        self.calls.append(("update", (child,), {"name": name, "active": active}))
        if name is not None:
            child.name = name
        if active is not None:
            child.active = active
        return child


def _settings(database_url: str) -> Settings:
    return Settings(
        app_env="test",
        database_url=database_url,
        secret_key="a" * 32,
        log_level="INFO",
        session_cookie_secure=False,
    )


def test_child_repository_filters_by_household_and_active(tmp_path: Path) -> None:
    db_file = tmp_path / "repo_boundaries.db"
    settings = _settings(f"sqlite:///{db_file}")
    initialize_database(settings)

    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        household = Household(name="Home", timezone="UTC")
        other_household = Household(name="Other Home", timezone="UTC")
        session.add_all([household, other_household])
        session.flush()

        session.add_all(
            [
                Child(household_id=household.id, name="Alex", active=True),
                Child(household_id=household.id, name="Sam", active=False),
                Child(household_id=other_household.id, name="Other", active=True),
            ]
        )
        session.commit()

    with session_factory() as session:
        repository = ChildRepository(session)

        all_children = repository.list_by_household(household.id)
        active_children = repository.list_by_household(household.id, active_only=True)
        fetched = repository.get_by_id(household.id, all_children[0].id)

    assert [child.name for child in all_children] == ["Alex", "Sam"]
    assert [child.name for child in active_children] == ["Alex"]
    assert fetched is not None
    assert fetched.household_id == household.id


def test_child_service_delegates_to_repository() -> None:
    built_repositories: list[_FakeChildRepository] = []

    def repository_factory(session: object) -> _FakeChildRepository:
        repository = _FakeChildRepository(session)
        built_repositories.append(repository)
        return repository

    service = ChildService(repository_factory=repository_factory)
    fake_session = object()

    children = service.list_children(fake_session, 10, active_only=True)
    created = service.create_child(fake_session, 10, "  Riley  ")
    found = service.get_child(fake_session, 10, 99)
    updated = service.update_child(fake_session, 10, 99, name="  Updated  ", active=False)

    assert len(children) == 1
    assert children[0].name == "Demo"
    assert created.name == "Riley"
    assert found is not None
    assert found.id == 99
    assert updated is not None
    assert updated.name == "Updated"
    assert updated.active is False

    all_calls = [call for repository in built_repositories for call in repository.calls]
    assert ("list_by_household", (10,), {"active_only": True}) in all_calls
    assert any(call[0] == "add" and isinstance(call[1][0], Child) for call in all_calls)
    assert ("get_by_id", (10, 99), {}) in all_calls
    assert any(
        call[0] == "update" and call[2] == {"name": "Updated", "active": False}
        for call in all_calls
    )
