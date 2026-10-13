"""Frontend browser fixtures: refuse all non-wrapper-owned databases first."""
from pathlib import Path
import json
import os
import secrets
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from sqlalchemy import select
from app.config import get_settings
from app.db import get_session_factory
from app.models import User, HouseholdModuleAccess, UserModuleAccess, Module
from app.models.enums import UserRole
from app.security import hash_password
from app.smoke_safety import require_isolated_smoke_database
from app.services.modules import ModuleService
from PIL import Image


def main():
    settings = get_settings()
    database = require_isolated_smoke_database(settings.database_url)
    fixture_path = Path(os.environ["PLAYWRIGHT_SMOKE_FIXTURE_PATH"])
    if fixture_path.resolve().parent != database.parent:
        raise RuntimeError("Fixture must belong to the exact isolated database directory.")
    fixture = json.loads(fixture_path.read_text())
    with get_session_factory(settings.database_url)() as session:
        parent = session.scalar(select(User).where(User.email == fixture["parent_email"]))
        if parent is None:
            raise RuntimeError("Wrapper parent fixture does not exist.")
        ModuleService().ensure_catalog(session)
        session.get(Module, "family-tree").enabled = True
        session.merge(HouseholdModuleAccess(household_id=parent.household_id, module_key="family-tree", enabled=True))
        for name, view, manage in [("viewer", True, False), ("manager", True, True), ("denied", False, False)]:
            password = secrets.token_urlsafe(24)
            email = f"ft-{name}-{secrets.token_hex(6)}@example.test"
            user = User(household_id=parent.household_id, email=email, password_hash=hash_password(password), role=UserRole.PARENT, child_id=None)
            session.add(user)
            session.flush()
            session.add(UserModuleAccess(user_id=user.id, module_key="family-tree", can_view=view, can_manage=manage))
            fixture[name] = {"email": email, "password": password, "id": user.id}
        session.commit()
        fixture["household_id"] = parent.household_id
    photo = database.parent / "fixture-photo.png"
    Image.new("RGB", (24, 24), (42, 108, 150)).save(photo)
    os.chmod(photo, 0o600)
    fixture["photo_path"] = str(photo)
    fixture_path.write_text(json.dumps(fixture))
    os.chmod(fixture_path, 0o600)


if __name__ == "__main__":
    main()
