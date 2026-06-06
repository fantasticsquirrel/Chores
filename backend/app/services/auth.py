from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session

from app.models.core import User
from app.repositories.children import ChildRepository
from app.repositories.users import UserRepository
from app.security import hash_password, needs_rehash, verify_password


class ChildLoginStatus(str, Enum):
    AUTHENTICATED = "AUTHENTICATED"
    DUPLICATE_CHILD_NAMES = "DUPLICATE_CHILD_NAMES"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"


@dataclass(frozen=True)
class ChildLoginResult:
    status: ChildLoginStatus
    user: User | None = None


class AuthService:
    def __init__(
        self,
        repository_factory: Callable[[Session], UserRepository] = UserRepository,
        child_repository_factory: Callable[[Session], ChildRepository] = ChildRepository,
    ) -> None:
        self._repository_factory = repository_factory
        self._child_repository_factory = child_repository_factory

    def authenticate(self, session: Session, email: str, password: str) -> User | None:
        repository = self._repository_factory(session)
        normalized_email = email.strip().lower()
        user = repository.get_any_by_email(normalized_email)
        if user is None:
            return None

        if not self._verify_and_rehash(session, user, password):
            return None

        return user

    def authenticate_child(
        self,
        session: Session,
        parent_email: str,
        child_name: str,
        password: str,
    ) -> ChildLoginResult:
        user_repository = self._repository_factory(session)
        child_repository = self._child_repository_factory(session)

        parent = user_repository.get_parent_by_email(parent_email.strip().lower())
        if parent is None:
            return ChildLoginResult(status=ChildLoginStatus.INVALID_CREDENTIALS)

        normalized_child_name = child_name.strip().lower()
        children = child_repository.list_active_by_normalized_name(
            parent.household_id,
            normalized_child_name,
        )
        if len(children) > 1:
            return ChildLoginResult(status=ChildLoginStatus.DUPLICATE_CHILD_NAMES)
        if len(children) == 0:
            return ChildLoginResult(status=ChildLoginStatus.INVALID_CREDENTIALS)

        child_user = user_repository.get_child_user(parent.household_id, children[0].id)
        if child_user is None:
            return ChildLoginResult(status=ChildLoginStatus.INVALID_CREDENTIALS)

        if not self._verify_and_rehash(session, child_user, password):
            return ChildLoginResult(status=ChildLoginStatus.INVALID_CREDENTIALS)

        return ChildLoginResult(status=ChildLoginStatus.AUTHENTICATED, user=child_user)

    def get_user(self, session: Session, user_id: int) -> User | None:
        repository = self._repository_factory(session)
        return repository.get_by_id(user_id)

    def change_password(
        self,
        session: Session,
        user: User,
        current_password: str,
        new_password: str,
    ) -> bool:
        if not verify_password(current_password, user.password_hash):
            return False

        user.password_hash = hash_password(new_password)
        session.flush()
        return True

    def _verify_and_rehash(self, session: Session, user: User, password: str) -> bool:
        if not verify_password(password, user.password_hash):
            return False

        if needs_rehash(user.password_hash):
            user.password_hash = hash_password(password)
            session.flush()

        return True
