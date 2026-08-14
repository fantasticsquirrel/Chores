"""Seed a dedicated parent account for the disposable Playwright password-reset flow."""

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
from app.models.core import Household, User  # noqa: E402
from app.models.enums import UserRole  # noqa: E402
from app.security import hash_parent_password  # noqa: E402
from scripts.smoke_safety import require_isolated_smoke_database  # noqa: E402


@dataclass(frozen=True)
class PasswordResetSmokeFixture:
    parent_email: str
    old_password: str
    new_password: str


def main() -> None:
    settings = get_settings()
    require_isolated_smoke_database(settings.database_url)
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)

    suffix = secrets.token_hex(8)
    old_password = "playwright isolated original parent password"
    new_password = "playwright isolated replacement parent password"
    parent_email = f"playwright.reset.{suffix}@example.com"

    with session_factory() as session:
        next_household_id = (session.scalar(select(func.coalesce(func.max(Household.id), 0))) or 0) + 1
        next_user_id = (session.scalar(select(func.coalesce(func.max(User.id), 0))) or 0) + 1
        household = Household(
            id=next_household_id,
            name=f"Playwright Reset Household {suffix}",
            timezone="UTC",
            owner_user_id=next_user_id,
        )
        session.add(household)
        session.add(
            User(
                id=next_user_id,
                household_id=next_household_id,
                email=parent_email,
                password_hash=hash_parent_password(old_password),
                role=UserRole.PARENT,
                child_id=None,
            )
        )
        session.commit()

    print(json.dumps(asdict(PasswordResetSmokeFixture(parent_email, old_password, new_password)), separators=(",", ":")))


if __name__ == "__main__":
    main()
