from __future__ import annotations

from sqlalchemy import select

from app.models.core import User
from app.models.enums import UserRole
from app.repositories.base import SQLAlchemyRepository


class UserRepository(SQLAlchemyRepository):
    def get_by_email(self, household_id: int, email: str) -> User | None:
        query = select(User).where(User.household_id == household_id, User.email == email)
        return self.session.scalars(query).one_or_none()

    def get_any_by_email(self, email: str) -> User | None:
        query = select(User).where(User.email == email)
        return self.session.scalars(query).one_or_none()

    def get_parent_by_email(self, email: str) -> User | None:
        query = select(User).where(
            User.email == email,
            User.role.in_((UserRole.PARENT, UserRole.PARENT_ADMIN)),
        )
        return self.session.scalars(query).one_or_none()

    def get_child_user(self, household_id: int, child_id: int) -> User | None:
        query = (
            select(User)
            .where(
                User.household_id == household_id,
                User.child_id == child_id,
                User.role == UserRole.CHILD,
            )
            .order_by(User.id.asc())
        )
        return self.session.scalars(query).first()

    def get_by_id(self, user_id: int) -> User | None:
        return self.session.get(User, user_id)
