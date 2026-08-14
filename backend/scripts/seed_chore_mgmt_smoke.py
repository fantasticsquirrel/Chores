"""Seed a minimal household with two children for chore management E2E tests."""
from __future__ import annotations

import json
import secrets
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import func, select  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import get_session_factory, initialize_database  # noqa: E402
from app.models.core import Child, Household, User  # noqa: E402
from app.models.enums import UserRole  # noqa: E402
from app.security import hash_password  # noqa: E402
from scripts.smoke_safety import require_isolated_smoke_database  # noqa: E402


@dataclass(frozen=True)
class ChoreFixture:
    parent_email: str
    parent_password: str
    child_one_name: str
    child_two_name: str


def main() -> None:
    settings = get_settings()
    require_isolated_smoke_database(settings.database_url)
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)

    suffix = secrets.token_hex(4)
    parent_password = "pw-chore-test"

    with session_factory() as session:
        next_household_id = (session.scalar(select(func.coalesce(func.max(Household.id), 0))) or 0) + 1
        next_user_id = (session.scalar(select(func.coalesce(func.max(User.id), 0))) or 0) + 1
        household = Household(
            id=next_household_id,
            name=f"Chore Mgmt Household {suffix}",
            timezone="UTC",
            owner_user_id=next_user_id,
        )
        session.add(household)

        child_one_name = f"Alice {suffix}"
        child_two_name = f"Bob {suffix}"

        parent_email = f"chore.parent.{suffix}@example.com"
        session.add(
            User(
                id=next_user_id,
                household_id=next_household_id,
                email=parent_email,
                password_hash=hash_password(parent_password),
                role=UserRole.PARENT,
                child_id=None,
            )
        )
        session.flush()

        session.add(Child(household_id=household.id, name=child_one_name, active=True))
        session.add(Child(household_id=household.id, name=child_two_name, active=True))
        session.commit()

    print(json.dumps(asdict(ChoreFixture(
        parent_email=parent_email,
        parent_password=parent_password,
        child_one_name=child_one_name,
        child_two_name=child_two_name,
    ))))


if __name__ == "__main__":
    main()
