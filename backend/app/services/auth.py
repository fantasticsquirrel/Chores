from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum

from itsdangerous import BadData, URLSafeSerializer
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import User
from app.models.enums import UserRole
from app.repositories.children import ChildRepository
from app.repositories.users import UserRepository
from app.security import hash_parent_password, hash_password, needs_rehash, verify_password

_LOGIN_ACCOUNT_TOKEN_SALT = "family-manager-login-account-v1"


def create_login_account_token(user_id: int, secret_key: str) -> str:
    """Create a tamper-evident public selector; this is not an auth credential."""
    return URLSafeSerializer(secret_key, salt=_LOGIN_ACCOUNT_TOKEN_SALT).dumps(
        {"user_id": user_id}
    )


def resolve_login_account_token(token: str, secret_key: str) -> int | None:
    try:
        payload = URLSafeSerializer(secret_key, salt=_LOGIN_ACCOUNT_TOKEN_SALT).loads(token)
    except BadData:
        return None
    if not isinstance(payload, dict):
        return None
    user_id = payload.get("user_id")
    if type(user_id) is not int or user_id <= 0:
        return None
    return user_id


class ChildLoginStatus(str, Enum):
    AUTHENTICATED = "AUTHENTICATED"
    DUPLICATE_CHILD_NAMES = "DUPLICATE_CHILD_NAMES"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"


@dataclass(frozen=True)
class AuthenticatedUser:
    user: User
    session_generation: int


@dataclass(frozen=True)
class LoginAccount:
    user_id: int
    display_name: str
    mode: str


@dataclass(frozen=True)
class ChildLoginResult:
    status: ChildLoginStatus
    user: User | None = None
    session_generation: int | None = None


class AuthService:
    def __init__(
        self,
        repository_factory: Callable[[Session], UserRepository] = UserRepository,
        child_repository_factory: Callable[[Session], ChildRepository] = ChildRepository,
    ) -> None:
        self._repository_factory = repository_factory
        self._child_repository_factory = child_repository_factory

    def authenticate(self, session: Session, email: str, password: str) -> AuthenticatedUser | None:
        repository = self._repository_factory(session)
        normalized_email = email.strip().lower()
        user = repository.get_any_by_email(normalized_email)
        return self._authenticate_user(session, user, password)

    def authenticate_account(self, session: Session, user_id: int, password: str) -> AuthenticatedUser | None:
        repository = self._repository_factory(session)
        return self._authenticate_user(session, repository.get_by_id(user_id), password)

    def list_login_accounts(self, session: Session) -> list[LoginAccount]:
        repository = self._repository_factory(session)
        accounts = [
            LoginAccount(
                user_id=user.id,
                display_name=(child_name or user.email).strip() or user.email,
                mode="child" if user.role == UserRole.CHILD else "parent",
            )
            for user, child_name in repository.list_active_login_accounts()
        ]
        return sorted(
            accounts,
            key=lambda account: (
                account.mode == "child",
                account.display_name.casefold(),
                account.user_id,
            ),
        )

    def _authenticate_user(
        self,
        session: Session,
        user: User | None,
        password: str,
    ) -> AuthenticatedUser | None:
        if user is None:
            return None

        verified_generation = self._verify_and_claim_generation(session, user, password)
        if verified_generation is None:
            return None
        return AuthenticatedUser(user=user, session_generation=verified_generation)

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

        verified_generation = self._verify_and_claim_generation(session, child_user, password)
        if verified_generation is None:
            return ChildLoginResult(status=ChildLoginStatus.INVALID_CREDENTIALS)

        return ChildLoginResult(
            status=ChildLoginStatus.AUTHENTICATED,
            user=child_user,
            session_generation=verified_generation,
        )

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
        if user.role in {UserRole.PARENT, UserRole.PARENT_ADMIN}:
            user.password_hash = hash_parent_password(new_password)
        else:
            user.password_hash = hash_password(new_password)
        session.flush()
        return True

    def _verify_and_claim_generation(self, session: Session, user: User, password: str) -> int | None:
        """Verify a password then atomically claim its current session generation."""
        if not verify_password(password, user.password_hash):
            return None

        needs_upgrade = needs_rehash(user.password_hash)
        upgraded_hash = hash_password(password) if needs_upgrade else None
        values = {"session_generation": User.session_generation}
        if upgraded_hash is not None:
            values["password_hash"] = upgraded_hash
        result = session.execute(
            update(User)
            .where(
                User.id == user.id,
                User.session_generation == user.session_generation,
                User.password_hash == user.password_hash,
            )
            .values(**values)
            .returning(User.session_generation)
        )
        verified_generation = result.scalar_one_or_none()
        if verified_generation is not None and upgraded_hash is not None:
            user.password_hash = upgraded_hash
        return verified_generation

    def _verify_and_rehash(self, session: Session, user: User, password: str) -> bool:
        if not verify_password(password, user.password_hash):
            return False

        if needs_rehash(user.password_hash):
            user.password_hash = hash_password(password)
            session.flush()

        return True
