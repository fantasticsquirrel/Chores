from __future__ import annotations

from collections.abc import Callable

from sqlalchemy.orm import Session

from app.models.core import User
from app.repositories.users import UserRepository
from app.security import needs_rehash, verify_password


class AuthService:
    def __init__(self, repository_factory: Callable[[Session], UserRepository] = UserRepository) -> None:
        self._repository_factory = repository_factory

    def authenticate(self, session: Session, email: str, password: str) -> User | None:
        repository = self._repository_factory(session)
        normalized_email = email.strip().lower()
        user = repository.get_any_by_email(normalized_email)
        if user is None:
            return None

        if not verify_password(password, user.password_hash):
            return None

        if needs_rehash(user.password_hash):
            from app.security import hash_password

            user.password_hash = hash_password(password)
            session.flush()

        return user

    def get_user(self, session: Session, user_id: int) -> User | None:
        repository = self._repository_factory(session)
        return repository.get_by_id(user_id)
