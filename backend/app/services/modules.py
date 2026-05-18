from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import HouseholdModuleAccess, Module, User, UserModuleAccess
from app.models.enums import UserRole
from app.modules import AVAILABLE_MODULES, DEFAULT_ROLE_MODULES, AppModule


class ModuleService:
    def ensure_catalog(self, session: Session) -> None:
        existing = set(session.scalars(select(Module.key)).all())
        for module in AVAILABLE_MODULES:
            if module.key in existing:
                continue
            session.add(Module(key=module.key, name=module.name, description=module.description, enabled=True))
        session.flush()

    def list_effective_modules(self, session: Session, user: User) -> list[AppModule]:
        self.ensure_catalog(session)
        catalog = {module.key: module for module in AVAILABLE_MODULES}
        allowed_keys = set(DEFAULT_ROLE_MODULES.get(user.role, ()))

        enabled_catalog_keys = set(
            session.scalars(select(Module.key).where(Module.enabled.is_(True))).all()
        )
        allowed_keys &= enabled_catalog_keys

        household_overrides = {
            row.module_key: row.enabled
            for row in session.scalars(
                select(HouseholdModuleAccess).where(HouseholdModuleAccess.household_id == user.household_id)
            ).all()
        }
        for key, enabled in household_overrides.items():
            if enabled and key in enabled_catalog_keys:
                allowed_keys.add(key)
            else:
                allowed_keys.discard(key)

        user_overrides = {
            row.module_key: row
            for row in session.scalars(select(UserModuleAccess).where(UserModuleAccess.user_id == user.id)).all()
        }
        for key, override in user_overrides.items():
            if override.can_view and key in enabled_catalog_keys:
                allowed_keys.add(key)
            else:
                allowed_keys.discard(key)

        return [module for module in AVAILABLE_MODULES if module.key in allowed_keys and module.key in catalog]

    def list_household_user_access(self, session: Session, household_id: int) -> list[tuple[User, list[AppModule]]]:
        users = session.scalars(select(User).where(User.household_id == household_id).order_by(User.email)).all()
        return [(user, self.list_effective_modules(session, user)) for user in users]

    def set_user_access(self, session: Session, target_user: User, module_key: str, can_view: bool, can_manage: bool = False) -> UserModuleAccess:
        self.ensure_catalog(session)
        if module_key not in {module.key for module in AVAILABLE_MODULES}:
            raise ValueError("Unknown module key.")
        access = session.get(UserModuleAccess, {"user_id": target_user.id, "module_key": module_key})
        if access is None:
            access = UserModuleAccess(user_id=target_user.id, module_key=module_key, can_view=can_view, can_manage=can_manage)
            session.add(access)
        else:
            access.can_view = can_view
            access.can_manage = can_manage
        session.flush()
        return access


def module_keys(modules: list[AppModule]) -> list[str]:
    return [module.key for module in modules]
