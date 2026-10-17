"""Owner-only operational directory and module switches, without content reads.

Read paths deliberately do not call catalog/billing seed-on-read helpers. Mutation
callers own commit/rollback; a write lock covers missing-row source defaults and
the global gate as well as the household flag and its append-only audit record.
"""
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from fastapi import HTTPException

from app.models.billing import HouseholdEntitlement
from app.models.enums import UserRole
from app.models.identity import Household, User
from app.models.modules import HouseholdModuleAccess, Module
from app.modules import AVAILABLE_MODULES, MODULE_ADMIN, AppModule
from app.services.modules import ModuleService
from app.services.ops.billing_reconciliation import get_household_or_404
from app.services.ops.platform_users import redact_email


def source_default(module_key: str) -> bool:
    # Match ModuleService.ensure_catalog/list_household_access opt-in semantics.
    return module_key != "family-tree"


def _module(module_key: str) -> AppModule:
    module = next((item for item in AVAILABLE_MODULES if item.key == module_key), None)
    if module is None:
        raise HTTPException(404, "Unknown module key.")
    return module


def _global_flags(db: Session) -> dict[str, bool]:
    stored = dict(db.execute(select(Module.key, Module.enabled)).all())
    return {module.key: stored.get(module.key, source_default(module.key)) for module in AVAILABLE_MODULES}


def overview(db: Session) -> dict:
    return {
        "household_count": db.scalar(select(func.count()).select_from(Household)),
        "account_count": db.scalar(select(func.count()).select_from(User)),
        "active_account_count": db.scalar(select(func.count()).select_from(User).where(User.active.is_(True))),
        "enabled_module_count": sum(_global_flags(db).values()),
        "module_count": len(AVAILABLE_MODULES),
    }


def _account_counts(db: Session, household_id: int) -> tuple[int, int]:
    return (
        db.scalar(select(func.count()).select_from(User).where(User.household_id == household_id)),
        db.scalar(select(func.count()).select_from(User).where(User.household_id == household_id, User.active.is_(True))),
    )


def list_households(db: Session, query: str, offset: int, limit: int) -> dict:
    statement = select(Household)
    normalized = query.strip().lower()
    if normalized:
        literal = normalized.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{literal}%"
        member_match = select(User.id).where(
            User.household_id == Household.id,
            User.role.in_([UserRole.PARENT, UserRole.PARENT_ADMIN]),
            User.email.ilike(pattern, escape="\\"),
        ).exists()
        statement = statement.where(or_(
            Household.name.ilike(pattern, escape="\\"),
            cast(Household.id, String) == normalized,
            member_match,
        ))
    total = db.scalar(select(func.count()).select_from(statement.subquery()))
    items = []
    for household in db.scalars(statement.order_by(Household.id).offset(offset).limit(limit)):
        owner = db.get(User, household.owner_user_id)
        entitlement = db.get(HouseholdEntitlement, household.id)
        count, active = _account_counts(db, household.id)
        items.append({
            "id": household.id, "name": household.name, "timezone": household.timezone,
            "owner_email": redact_email(owner.email) if owner else "***",
            "billing_status": entitlement.status.value if entitlement else "none",
            "account_count": count, "active_account_count": active,
        })
    return {"items": items, "total": total, "offset": offset, "limit": limit}


def list_accounts(db: Session, household_id: int, offset: int, limit: int) -> dict:
    household = get_household_or_404(db, household_id)
    statement = select(User).where(User.household_id == household_id)
    total = db.scalar(select(func.count()).select_from(statement.subquery()))
    return {
        "household_id": household_id, "total": total, "offset": offset, "limit": limit,
        "items": [{
            "id": user.id, "email": user.email, "role": user.role.value,
            "active": user.active, "is_household_owner": user.id == household.owner_user_id,
        } for user in db.scalars(statement.order_by(User.id).offset(offset).limit(limit))],
    }


def _released(module: AppModule) -> bool:
    return any(platform.supported for platform in module.platforms.values())


def _restriction(module: AppModule, globally_enabled: bool = True) -> str | None:
    reasons = []
    if module.key == MODULE_ADMIN:
        reasons.append("The admin module cannot be disabled.")
    if not _released(module):
        reasons.append("This module is unavailable: not released on any platform.")
    if not globally_enabled:
        reasons.append("This module is disabled globally and cannot be enabled for a household.")
    return " ".join(reasons) or None


def global_module(module: AppModule, enabled: bool) -> dict:
    return {
        "key": module.key, "name": module.name, "description": module.description,
        "enabled": enabled, "can_enable": _released(module), "can_disable": module.key != MODULE_ADMIN,
        "restriction": _restriction(module),
        "platforms": {key: value.supported for key, value in module.platforms.items()},
    }


def list_global_modules(db: Session) -> list[dict]:
    flags = _global_flags(db)
    return [global_module(module, flags[module.key]) for module in AVAILABLE_MODULES]


def household_module(module: AppModule, enabled: bool, globally_enabled: bool) -> dict:
    return {
        "key": module.key, "name": module.name, "description": module.description,
        "enabled": enabled, "globally_enabled": globally_enabled,
        "effective_enabled": enabled and globally_enabled,
        "can_enable": globally_enabled and _released(module), "can_disable": module.key != MODULE_ADMIN,
        "restriction": _restriction(module, globally_enabled),
    }


def list_household_modules(db: Session, household_id: int) -> list[dict]:
    get_household_or_404(db, household_id)
    flags = _global_flags(db)
    stored = dict(db.execute(select(HouseholdModuleAccess.module_key, HouseholdModuleAccess.enabled).where(
        HouseholdModuleAccess.household_id == household_id,
    )).all())
    return [household_module(module, stored.get(module.key, source_default(module.key)), flags[module.key])
            for module in AVAILABLE_MODULES]


def lock_module_change(db: Session, module_key: str, household_id: int | None) -> None:
    # Authentication performs SELECTs only before this point. Like family-tree
    # transfer admission, explicitly begin the SQLite writer transaction before
    # reading source defaults; row locks alone cannot protect an absent row.
    connection = db.connection()
    if connection.dialect.name == "sqlite":
        if not connection.connection.driver_connection.in_transaction:
            connection.exec_driver_sql("BEGIN IMMEDIATE")
    else:
        # Serialize missing catalog rows too. All owner mutations take this lock
        # in the same order; existing catalog rows also serialize consumer edits.
        db.execute(select(Household.id).order_by(Household.id).with_for_update()).all()
        db.execute(select(Module.key).where(Module.key == module_key).with_for_update()).all()
    db.expire_all()


def change_module(db: Session, *, module_key: str, household_id: int | None,
                  enabled: bool, expected_enabled: bool) -> dict:
    module = _module(module_key)
    lock_module_change(db, module_key, household_id)
    if household_id is not None:
        get_household_or_404(db, household_id)
    flags = _global_flags(db)
    if household_id is None:
        previous = flags[module_key]
    else:
        stored = db.get(HouseholdModuleAccess, (household_id, module_key))
        previous = stored.enabled if stored is not None else source_default(module_key)
    if previous != expected_enabled:
        raise HTTPException(409, "Module state changed. Reload before trying again.")
    if not enabled and module_key == MODULE_ADMIN:
        raise HTTPException(400, "The admin module cannot be disabled.")
    if enabled and not _released(module):
        raise HTTPException(400, "This module is unavailable: not released on any platform.")
    if enabled and household_id is not None and not flags[module_key]:
        raise HTTPException(400, "This module is disabled globally and cannot be enabled for a household.")
    # Reuse canonical catalog/default/household rules; never touch user grants.
    service = ModuleService()
    if household_id is None:
        service.ensure_catalog(db)
        db.get(Module, module_key).enabled = enabled
        db.flush()
        return global_module(module, enabled)
    try:
        service.set_household_access(db, household_id=household_id, module_key=module_key, enabled=enabled)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return household_module(module, enabled, flags[module_key])
