from __future__ import annotations

import json
from pathlib import Path

from app.models.enums import UserRole
from app.modules import AVAILABLE_MODULES, DEFAULT_ROLE_MODULES


def test_backend_module_registry_matches_shared_contract() -> None:
    contract_path = Path(__file__).resolve().parents[2] / "packages" / "family-api" / "module-contract.json"
    contract = json.loads(contract_path.read_text())

    assert [module.__dict__ for module in AVAILABLE_MODULES] == contract["modules"]
    assert {
        role.value: list(module_keys)
        for role, module_keys in DEFAULT_ROLE_MODULES.items()
    } == contract["default_role_modules"]
    assert set(DEFAULT_ROLE_MODULES) == {UserRole.PARENT_ADMIN, UserRole.PARENT, UserRole.CHILD}
