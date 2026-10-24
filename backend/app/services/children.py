from __future__ import annotations

from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Child, User
from app.models.enums import UserRole
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

    def linked_child_ids(self, session: Session, household_id: int) -> set[int]:
        """Return only login presence, scoped to the authorized household."""
        return set(session.scalars(select(User.child_id).where(
            User.household_id == household_id, User.role == UserRole.CHILD, User.child_id.is_not(None)
        )).all())

    def create_child(self, session: Session, household_id: int, name: str, *, active: bool = True) -> Child:
        repository = self._repository_factory(session)
        child = Child(household_id=household_id, name=name.strip(), active=active)
        return repository.add(child)

    def get_child(self, session: Session, household_id: int, child_id: int) -> Child | None:
        repository = self._repository_factory(session)
        return repository.get_by_id(household_id, child_id)

    def update_child(
        self,
        session: Session,
        household_id: int,
        child_id: int,
        *,
        name: str | None = None,
        active: bool | None = None,
    ) -> Child | None:
        repository = self._repository_factory(session)
        child = repository.get_by_id(household_id, child_id)
        if child is None:
            return None

        normalized_name = name.strip() if name is not None else None
        return repository.update(child, name=normalized_name, active=active)
