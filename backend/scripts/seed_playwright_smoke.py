from __future__ import annotations

import json
import secrets
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import func, select  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import get_session_factory, initialize_database  # noqa: E402
from app.models import Child, Chore, Household, User  # noqa: E402
from app.models.enums import AssignmentMode, CompletionMode, ScheduleMode, UserRole  # noqa: E402
from app.security import hash_password  # noqa: E402
from scripts.smoke_safety import require_isolated_smoke_database  # noqa: E402


@dataclass(frozen=True)
class SmokeFixture:
    parent_email: str
    parent_password: str
    child_email: str
    child_password: str
    child_name: str
    chore_name: str
    create_child_name: str


def main() -> None:
    settings = get_settings()
    require_isolated_smoke_database(settings.database_url)
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)

    run_suffix = secrets.token_hex(4)
    today = datetime.now(UTC).date()
    parent_password = "playwright-parent-pass"
    child_password = "playwright-child-pass"
    child_name = f"Smoke Child {run_suffix}"
    chore_name = f"Playwright Smoke Chore {run_suffix}"

    with session_factory() as session:
        next_household_id = (session.scalar(select(func.coalesce(func.max(Household.id), 0))) or 0) + 1
        next_user_id = (session.scalar(select(func.coalesce(func.max(User.id), 0))) or 0) + 1
        household = Household(
            id=next_household_id,
            name=f"Playwright Smoke Household {run_suffix}",
            timezone="UTC",
            owner_user_id=next_user_id,
        )
        session.add(household)

        parent_email = f"playwright.parent.{run_suffix}@example.com"
        child_email = f"playwright.child.{run_suffix}@example.com"

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

        child = Child(household_id=household.id, name=child_name, active=True)
        session.add(child)
        session.flush()

        session.add(
            User(
                household_id=household.id,
                email=child_email,
                password_hash=hash_password(child_password),
                role=UserRole.CHILD,
                child_id=child.id,
            )
        )
        session.add(
            Chore(
                household_id=household.id,
                name=chore_name,
                reward_cents=325,
                start_date=today,
                expires_at=None,
                timeout_days=None,
                schedule_mode=ScheduleMode.NONE,
                schedule_interval=None,
                schedule_unit=None,
                completion_mode=CompletionMode.PER_CHILD,
                assignment_mode=AssignmentMode.STATIC,
                archived_at=None,
            )
        )
        session.commit()

    fixture = SmokeFixture(
        parent_email=parent_email,
        parent_password=parent_password,
        child_email=child_email,
        child_password=child_password,
        child_name=child_name,
        chore_name=chore_name,
        create_child_name=f"Created In UI {run_suffix}",
    )
    print(json.dumps(asdict(fixture)))


if __name__ == "__main__":
    main()
