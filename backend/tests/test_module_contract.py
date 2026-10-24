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
        "family-tree",
        "discovery-lab",
    ]
    assert AVAILABLE_MODULES[0].labels == {"web": "Chores", "mobile": "Chores"}
    assert AVAILABLE_MODULES[2].platforms["mobile"].supported is True
    assert AVAILABLE_MODULES[2].platforms["mobile"].destination == "recipes"
    tree = next(module for module in AVAILABLE_MODULES if module.key == "family-tree")
    assert tree.platforms["web"].supported and tree.platforms["mobile"].supported
    assert tree.platforms["web"].destination == "/family-tree"
    assert tree.platforms["mobile"].destination == "family-tree"
    assert all(platform.roles == (UserRole.PARENT_ADMIN, UserRole.PARENT)
               and platform.navigation and platform.dashboard for platform in tree.platforms.values())
    assert {
        role.value: list(module_keys)
        for role, module_keys in DEFAULT_ROLE_MODULES.items()
    } == {
        "PARENT_ADMIN": ["chores", "homeschool", "recipes", "admin", "family-tree", "discovery-lab"],
        "PARENT": ["chores", "homeschool", "recipes", "family-tree", "discovery-lab"],
        "CHILD": ["chores", "discovery-lab"],
    }
    assert set(DEFAULT_ROLE_MODULES) == {UserRole.PARENT_ADMIN, UserRole.PARENT, UserRole.CHILD}
