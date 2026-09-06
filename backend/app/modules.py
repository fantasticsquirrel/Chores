from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.models.enums import UserRole

MODULE_MANIFEST_PATH = Path(__file__).resolve().parents[2] / "packages" / "family-api" / "module-contract.json"
MODULE_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9-]*$")
PLATFORMS = ("web", "mobile")


@dataclass(frozen=True)
class AppModulePlatform:
    supported: bool
    destination: str | None
    roles: tuple[UserRole, ...]
    navigation: bool
    dashboard: bool


@dataclass(frozen=True)
class AppModule:
    key: str
    name: str
    description: str
    labels: dict[str, str]
    default_grants: dict[UserRole, bool]
    platforms: dict[str, AppModulePlatform]


def _require_mapping(value: object, location: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise RuntimeError(f"Module manifest {location} must be an object.")
    return value


def _load_module_manifest(path: Path = MODULE_MANIFEST_PATH) -> tuple[AppModule, ...]:
    try:
        document = _require_mapping(json.loads(path.read_text(encoding="utf-8")), "root")
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Could not load canonical module manifest at {path}.") from exc

    if document.get("schema_version") != 1:
        raise RuntimeError("Module manifest schema_version must be 1.")
    entries = _require_mapping(document.get("modules"), "modules")
    modules: list[AppModule] = []
    expected_roles = {role.value for role in UserRole}

    for object_key, raw_value in entries.items():
        raw = _require_mapping(raw_value, f"modules.{object_key}")
        key = raw.get("key")
        if (
            key != object_key
            or not isinstance(key, str)
            or MODULE_KEY_PATTERN.fullmatch(key) is None
        ):
            raise RuntimeError(
                f"Module manifest key {object_key!r} is invalid or inconsistent."
            )
        name = raw.get("name")
        description = raw.get("description")
        if (
            not isinstance(name, str)
            or not name.strip()
            or not isinstance(description, str)
            or not description.strip()
        ):
            raise RuntimeError(f"Module manifest entry {key!r} requires name and description.")

        labels = _require_mapping(raw.get("labels"), f"modules.{key}.labels")
        if set(labels) != set(PLATFORMS) or any(
            not isinstance(label, str) or not label.strip() for label in labels.values()
        ):
            raise RuntimeError(f"Module manifest entry {key!r} requires non-empty platform labels.")

        raw_grants = _require_mapping(
            raw.get("default_grants"),
            f"modules.{key}.default_grants",
        )
        if set(raw_grants) != expected_roles or any(
            type(grant) is not bool for grant in raw_grants.values()
        ):
            raise RuntimeError(
                f"Module manifest entry {key!r} must define every role default grant."
            )
        default_grants = {UserRole(role): raw_grants[role] for role in raw_grants}

        raw_platforms = _require_mapping(raw.get("platforms"), f"modules.{key}.platforms")
        if set(raw_platforms) != set(PLATFORMS):
            raise RuntimeError(f"Module manifest entry {key!r} must define web and mobile support.")
        platforms: dict[str, AppModulePlatform] = {}
        for platform in PLATFORMS:
            raw_platform = _require_mapping(
                raw_platforms[platform], f"modules.{key}.platforms.{platform}"
            )
            try:
                raw_roles = raw_platform["roles"]
                if not isinstance(raw_roles, list):
                    raise TypeError("roles must be a list")
                roles = tuple(UserRole(role) for role in raw_roles)
                definition = AppModulePlatform(
                    supported=raw_platform["supported"],
                    destination=raw_platform["destination"],
                    roles=roles,
                    navigation=raw_platform["navigation"],
                    dashboard=raw_platform["dashboard"],
                )
            except (KeyError, TypeError, ValueError) as exc:
                raise RuntimeError(
                    f"Module manifest entry {key!r} has invalid {platform} metadata."
                ) from exc
            if any(
                type(flag) is not bool
                for flag in (definition.supported, definition.navigation, definition.dashboard)
            ):
                raise RuntimeError(
                    f"Module manifest entry {key!r} has invalid {platform} flags."
                )
            if len(set(definition.roles)) != len(definition.roles):
                raise RuntimeError(
                    f"Module manifest entry {key!r} repeats a {platform} role."
                )
            if definition.supported and (
                not isinstance(definition.destination, str)
                or not definition.destination.strip()
            ):
                raise RuntimeError(
                    f"Module manifest entry {key!r} must pair {platform} support with a destination."
                )
            if not definition.supported and (
                definition.destination is not None
                or definition.roles
                or definition.navigation
                or definition.dashboard
            ):
                raise RuntimeError(
                    f"Unsupported {platform} module {key!r} cannot expose roles, navigation, or dashboard UI."
                )
            if any(not default_grants[role] for role in definition.roles):
                raise RuntimeError(
                    f"Module manifest entry {key!r} grants a {platform} role without a default grant."
                )
            platforms[platform] = definition

        modules.append(
            AppModule(
                key=key,
                name=name,
                description=description,
                labels={platform: labels[platform] for platform in PLATFORMS},
                default_grants=default_grants,
                platforms=platforms,
            )
        )

    if not modules:
        raise RuntimeError("Module manifest must define at least one module.")
    return tuple(modules)


AVAILABLE_MODULES = _load_module_manifest()


def _registered_key(key: str) -> str:
    if key not in {module.key for module in AVAILABLE_MODULES}:
        raise RuntimeError(
            f"Required module {key!r} is absent from the canonical manifest."
        )
    return key


MODULE_CHORES = _registered_key("chores")
MODULE_HOMESCHOOL = _registered_key("homeschool")
MODULE_ADMIN = _registered_key("admin")
MODULE_RECIPES = _registered_key("recipes")

DEFAULT_ROLE_MODULES: dict[UserRole, tuple[str, ...]] = {
    role: tuple(module.key for module in AVAILABLE_MODULES if module.default_grants[role])
    for role in UserRole
}


def get_modules_for_role(role: UserRole) -> list[AppModule]:
    allowed_keys = set(DEFAULT_ROLE_MODULES.get(role, ()))
    return [module for module in AVAILABLE_MODULES if module.key in allowed_keys]
