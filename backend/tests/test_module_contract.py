from __future__ import annotations

from app.models.enums import UserRole
from app.modules import AVAILABLE_MODULES, DEFAULT_ROLE_MODULES, MODULE_MANIFEST_PATH


def test_backend_module_registry_matches_shared_contract() -> None:
    assert MODULE_MANIFEST_PATH.is_file()
    assert [module.key for module in AVAILABLE_MODULES] == [
        "chores",
        "homeschool",
        "recipes",
        "admin",
    ]
    assert AVAILABLE_MODULES[0].labels == {"web": "Chores", "mobile": "Chores"}
    assert AVAILABLE_MODULES[2].platforms["mobile"].supported is False
    assert AVAILABLE_MODULES[2].platforms["mobile"].destination is None
    assert {
        role.value: list(module_keys)
        for role, module_keys in DEFAULT_ROLE_MODULES.items()
    } == {
        "PARENT_ADMIN": ["chores", "homeschool", "recipes", "admin"],
        "PARENT": ["chores", "homeschool", "recipes"],
        "CHILD": ["chores"],
    }
    assert set(DEFAULT_ROLE_MODULES) == {UserRole.PARENT_ADMIN, UserRole.PARENT, UserRole.CHILD}
