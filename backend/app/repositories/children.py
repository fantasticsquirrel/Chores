from __future__ import annotations

from sqlalchemy import Select, select

from app.models.core import Child
from app.repositories.base import SQLAlchemyRepository


class ChildRepository(SQLAlchemyRepository):
    def list_by_household(self, household_id: int, *, active_only: bool = False) -> list[Child]:
        query: Select[tuple[Child]] = select(Child).where(Child.household_id == household_id)
        if active_only:
            query = query.where(Child.active.is_(True))

        query = query.order_by(Child.id.asc())
        return list(self.session.scalars(query).all())

    def get_by_id(self, household_id: int, child_id: int) -> Child | None:
        query = select(Child).where(Child.household_id == household_id, Child.id == child_id)
        return self.session.scalars(query).one_or_none()

    def add(self, child: Child) -> Child:
        self.session.add(child)
        self.session.flush()
        self.session.refresh(child)
        return child
