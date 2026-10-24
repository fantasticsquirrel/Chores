"""Enable Discovery Lab only in the wrapper-owned disposable smoke household."""
from __future__ import annotations

import json
import os
from pathlib import Path
from sqlalchemy import select
from app.config import get_settings
from app.db import get_session_factory
from app.models import User
from app.services.modules import ModuleService
from scripts.smoke_safety import require_isolated_smoke_database


def main() -> None:
    settings = get_settings()
    require_isolated_smoke_database(settings.database_url)
    smoke_dir = Path(os.environ["PLAYWRIGHT_SMOKE_DIR"]).resolve()
    fixture_path = Path(os.environ["PLAYWRIGHT_SMOKE_FIXTURE_PATH"]).resolve()
    if fixture_path.parent != smoke_dir or not (smoke_dir / ".family-manager-smoke").is_file():
        raise RuntimeError("Discovery fixtures require the isolated smoke wrapper.")
    fixture = json.loads(fixture_path.read_text())
    factory = get_session_factory(settings.database_url)
    with factory() as session:
        parent = session.scalar(select(User).where(User.email == fixture["parent_email"]))
        if parent is None:
            raise RuntimeError("Smoke parent was not seeded.")
        ModuleService().set_household_access(
            session, household_id=parent.household_id, module_key="discovery-lab", enabled=True
        )
        session.commit()


if __name__ == "__main__":
    main()
