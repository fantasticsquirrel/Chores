from __future__ import annotations

from collections.abc import Callable

from sqlalchemy.orm import Session

from app.models.core import Child
from app.repositories.children import ChildRepository


class ChildService:
    """Business operations for child management.

    Services orchestrate repository calls and keep API handlers thin.
    """

    def __init__(self, repository_factory: Callable[[Session], ChildRepository] = ChildRepository) -> None:
        self._repository_factory = repository_factory

    def list_children(self, session: Session, household_id: int, *, active_only: bool = False) -> list[Child]:
        repository = self._repository_factory(session)
        return repository.list_by_household(household_id, active_only=active_only)

    def create_child(self, session: Session, household_id: int, name: str, *, active: bool = True) -> Child:
        repository = self._repository_factory(session)
        child = Child(household_id=household_id, name=name.strip(), active=active)
        return repository.add(child)

    def get_child(self, session: Session, household_id: int, child_id: int) -> Child | None:
        repository = self._repository_factory(session)
        return repository.get_by_id(household_id, child_id)
