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

from sqlalchemy import select

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.models.core import Child, Chore, Household, User
from app.models.enums import AssignmentMode, CompletionMode, ScheduleMode, UserRole
from app.security import hash_password


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
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)

    run_suffix = secrets.token_hex(4)
    today = datetime.now(UTC).date()
    parent_password = "playwright-parent-pass"
    child_password = "playwright-child-pass"
    child_name = f"Smoke Child {run_suffix}"
    chore_name = f"Playwright Smoke Chore {run_suffix}"

    with session_factory() as session:
        household = Household(name=f"Playwright Smoke Household {run_suffix}", timezone="UTC")
        session.add(household)
        session.flush()

        parent_email = f"playwright.parent.{run_suffix}@example.com"
        child_email = f"playwright.child.{run_suffix}@example.com"

        child = Child(household_id=household.id, name=child_name, active=True)
        session.add(child)
        session.flush()

        session.add(
            User(
                household_id=household.id,
                email=parent_email,
                password_hash=hash_password(parent_password),
                role=UserRole.PARENT,
                child_id=None,
            )
        )
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
