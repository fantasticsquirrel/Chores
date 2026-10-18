from datetime import UTC, datetime, timedelta
import json
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from ops_owner_fixtures import owner_env, login, age_session, reauth
from app.models.modules import Module, HouseholdModuleAccess, UserModuleAccess
from app.models.identity import User
from app.models.platform import PlatformAuditEvent, PlatformSession, PlatformUser
from app.modules import AVAILABLE_MODULES
from app.services.modules import ModuleService

BASE = "/ops-api/owner"
READS = ["/overview", "/households", "/modules", "/households/101/modules", "/households/101/accounts"]
TARGETS = ["/modules/recipes", "/households/101/modules/recipes"]


def snapshot(env):
    with env["sf"]() as db:
        return {table: db.execute(text(f"SELECT * FROM {table}")).all() for table in (
            "modules", "household_module_access", "user_module_access", "platform_audit_events",
            "users", "households", "billing_accounts", "household_entitlements",
        )}


def payload(enabled=False, expected=True):
    return {"enabled": enabled, "expected_enabled": expected, "reason": "  Operational test  "}


def module_by_key(response, key):
    assert response.status_code == 200, response.text
    return next(item for item in response.json() if item["key"] == key)


def test_owner_reads_are_private_read_only_and_authoritative(owner_env):
    env = owner_env
    login(env)
    before = snapshot(env)
    results = {path: env["client"].get(BASE + path) for path in READS}
    for response in results.values():
        assert response.status_code == 200, response.text
        assert {"private", "no-store"} <= set(response.headers["cache-control"].replace(" ", "").split(","))
    assert results["/overview"].json() == {
        "household_count": 2, "account_count": 5, "active_account_count": 4,
        "enabled_module_count": len(AVAILABLE_MODULES) - 1, "module_count": len(AVAILABLE_MODULES),
    }
    directory = results["/households"].json()
    assert directory["total"] == 2 and directory["offset"] == 0 and directory["limit"] == 25
    assert directory["items"][0] == {
        "id": 101, "name": "Literal_% Home", "owner_email": "o***@example.com", "billing_status": "none",
        "timezone": "Europe/Berlin", "account_count": 4, "active_account_count": 3,
    }
    global_tree = module_by_key(results["/modules"], "family-tree")
    assert global_tree["platforms"] == {"web": True, "mobile": True}
    assert not global_tree["enabled"] and global_tree["can_enable"] and global_tree["restriction"] is None
    tree = module_by_key(results["/households/101/modules"], "family-tree")
    assert not tree["enabled"] and not tree["effective_enabled"] and not tree["can_enable"]
    admin = module_by_key(results["/modules"], "admin")
    assert not admin["can_disable"] and admin["restriction"]
    assert snapshot(env) == before


def test_member_search_literal_wildcards_dedup_and_pagination(owner_env):
    env = owner_env
    login(env)
    for query, ids in [(" MEMBER-MATCH ", [101]), ("101", [101]), ("literal", [101]),
                       ("_%", [101]), ("%", [101]), ("_", [101]), ("child-private", []), ("\\", [])]:
        response = env["client"].get(BASE + "/households", params={"query": query})
        assert response.status_code == 200
        assert [item["id"] for item in response.json()["items"]] == ids
        assert response.json()["total"] == len(ids)
    response = env["client"].get(BASE + "/households", params={"limit": 1, "offset": 1}).json()
    assert response["total"] == 2 and [item["id"] for item in response["items"]] == [102]
    assert response["limit"] == 1 and response["offset"] == 1
    assert env["client"].get(BASE + "/households", params={"offset": 99}).json()["items"] == []
    for params in ({"offset": -1}, {"limit": 0}, {"limit": 51}, {"query": "x" * 201}):
        assert env["client"].get(BASE + "/households", params=params).status_code == 422


def test_account_summary_is_scoped_paginated_and_has_only_safe_fields(owner_env):
    env = owner_env
    login(env)
    response = env["client"].get(BASE + "/households/101/accounts", params={"limit": 2, "offset": 2})
    data = response.json()
    assert response.status_code == 200 and data["household_id"] == 101 and data["total"] == 4
    assert data["offset"] == 2 and data["limit"] == 2
    assert data["items"] == [
        {"id": 203, "email": "member-match2@example.com", "role": "PARENT", "active": False, "is_household_owner": False},
        {"id": 205, "email": "child-private@example.com", "role": "CHILD", "active": True, "is_household_owner": False},
    ]
    first = env["client"].get(BASE + "/households/101/accounts").json()["items"][0]
    assert first["is_household_owner"] is True
    for suffix in ("accounts", "modules"):
        assert env["client"].get(BASE + f"/households/999/{suffix}").status_code == 404
    assert env["client"].get(BASE + "/households/101/accounts?limit=51").status_code == 422


@pytest.mark.parametrize("realm", ["anonymous", "support", "household"])
def test_realm_and_support_separation_no_writes(owner_env, realm):
    env = owner_env
    headers = {}
    if realm == "support":
        headers = login(env, 2)
    elif realm == "household":
        response = env["client"].post("/chore-api/auth/login", json={"email": "owner@example.com", "password": "fixture-password"})
        assert response.status_code == 200
    before = snapshot(env)
    status = 403 if realm == "support" else 401
    for path in READS:
        assert env["client"].get(BASE + path).status_code == status
    for path in TARGETS:
        assert env["client"].post(BASE + path, headers=headers, json=payload()).status_code == status
    assert snapshot(env) == before


@pytest.mark.parametrize("target", TARGETS)
def test_csrf_reauth_validation_and_unknown_reject_without_writes(owner_env, target):
    env = owner_env
    headers = login(env)
    before = snapshot(env)
    assert env["client"].post(BASE + target, json=payload()).status_code == 403
    assert env["client"].post(BASE + target, headers={"X-Ops-CSRF-Token": "wrong"}, json=payload()).status_code == 403
    age_session(env)
    assert env["client"].post(BASE + target, headers=headers, json=payload()).status_code == 403
    assert snapshot(env) == before
    reauth(env, headers)
    before = snapshot(env)
    for update in ({"enabled": "false"}, {"expected_enabled": 1}, {"reason": "  "}, {"reason": "x" * 1001}, {"extra": True}):
        body = {**payload(), **update}
        assert env["client"].post(BASE + target, headers=headers, json=body).status_code == 422
    assert env["client"].post(BASE + target.replace("recipes", "unknown"), headers=headers, json=payload()).status_code == 404
    assert env["client"].post(BASE + "/households/999/modules/recipes", headers=headers, json=payload()).status_code == 404
    assert snapshot(env) == before


@pytest.mark.parametrize("target", ["/modules/admin", "/households/101/modules/admin", "/modules/family-tree", "/households/101/modules/family-tree"])
def test_protected_admin_and_unreleased_cannot_be_bypassed(owner_env, target, monkeypatch):
    env = owner_env
    headers = login(env)
    tree = target.endswith("family-tree")
    if tree:
        # Exercise the unchanged release safeguard with an unreleased fixture,
        # not a stale assertion that the now-released Family Tree is unavailable.
        from dataclasses import replace
        from app.services.ops import owner_management

        modules = tuple(
            replace(module, platforms={
                key: replace(platform, supported=False, destination=None,
                             roles=(), navigation=False, dashboard=False)
                for key, platform in module.platforms.items()
            }) if module.key == "family-tree" else module
            for module in AVAILABLE_MODULES
        )
        monkeypatch.setattr(owner_management, "AVAILABLE_MODULES", modules)
    before = snapshot(env)
    assert env["client"].post(BASE + target, headers=headers, json=payload(tree, not tree)).status_code == 400
    assert snapshot(env) == before


def test_global_and_household_state_readback_audit_and_effective_access(owner_env):
    env = owner_env
    headers = login(env)
    with env["sf"]() as db:
        ModuleService().ensure_catalog(db)
        db.add(UserModuleAccess(user_id=201, module_key="recipes", can_view=True, can_manage=True))
        db.commit()
    for target in ["/households/101/modules/recipes", "/modules/recipes"]:
        response = env["client"].post(BASE + target, headers=headers, json=payload())
        assert response.status_code == 200, response.text
        assert response.json()["enabled"] is False
        before = snapshot(env)
        assert env["client"].post(BASE + target, headers=headers, json=payload()).status_code == 409
        assert snapshot(env) == before
    state = module_by_key(env["client"].get(BASE + "/households/101/modules"), "recipes")
    assert not state["enabled"] and not state["globally_enabled"] and not state["effective_enabled"]
    assert not state["can_enable"] and state["restriction"]
    before = snapshot(env)
    assert env["client"].post(BASE + "/households/101/modules/recipes", headers=headers, json=payload(True, False)).status_code == 400
    assert snapshot(env) == before
    with env["sf"]() as db:
        assert not ModuleService().can_access_module(db, db.get(User, 201), "recipes")
        assert db.get(UserModuleAccess, (201, "recipes")).can_view
        events = db.scalars(select(PlatformAuditEvent).where(PlatformAuditEvent.event_type.like("module.%")).order_by(PlatformAuditEvent.id)).all()
        assert [(e.event_type, e.actor_platform_user_id, e.household_id, e.reason, json.loads(e.details_json)) for e in events] == [
            ("module.household_access_changed", 1, 101, "Operational test", {"module_key": "recipes", "previous_enabled": True, "enabled": False}),
            ("module.global_access_changed", 1, None, "Operational test", {"module_key": "recipes", "previous_enabled": True, "enabled": False}),
        ]
    assert env["client"].post(BASE + "/modules/recipes", headers=headers, json=payload(True, False)).status_code == 200
    state = module_by_key(env["client"].get(BASE + "/households/101/modules"), "recipes")
    assert not state["enabled"] and state["globally_enabled"] and not state["effective_enabled"]
    assert env["client"].post(BASE + "/households/101/modules/recipes", headers=headers, json=payload(True, False)).status_code == 200
    with env["sf"]() as db:
        assert ModuleService().can_access_module(db, db.get(User, 201), "recipes")


@pytest.mark.parametrize("target", TARGETS)
def test_missing_row_default_stale_and_concurrent_compare_and_set(owner_env, target):
    env = owner_env
    headers = login(env)
    before = snapshot(env)
    assert env["client"].post(BASE + target, headers=headers, json=payload(True, False)).status_code == 409
    assert snapshot(env) == before
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: env["client"].post(BASE + target, headers=headers, json=payload()).status_code, range(2)))
    assert sorted(results) == [200, 409]
    with env["sf"]() as db:
        events = db.scalars(select(PlatformAuditEvent).where(PlatformAuditEvent.event_type.like("module.%"))).all()
        assert len(events) == 1


@pytest.mark.parametrize("invalid", ["expired", "revoked", "inactive"])
def test_invalid_operator_sessions_rejected(owner_env, invalid):
    env = owner_env
    headers = login(env)
    with env["sf"]() as db:
        row = db.scalar(select(PlatformSession).where(PlatformSession.platform_user_id == 1))
        if invalid == "expired":
            row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        elif invalid == "revoked":
            row.revoked_at = datetime.now(UTC)
        else:
            db.get(PlatformUser, 1).active = False
        db.commit()
    before = snapshot(env)
    for path in READS:
        assert env["client"].get(BASE + path).status_code == 401
    assert env["client"].post(BASE + TARGETS[0], headers=headers, json=payload()).status_code == 401
    assert snapshot(env) == before


@pytest.mark.parametrize("target", TARGETS)
def test_audit_failure_rolls_back_module_and_catalog_writes(owner_env, monkeypatch, target):
    from app.services.ops import audit
    env = owner_env
    headers = login(env)
    before = snapshot(env)

    def unavailable(*args, **kwargs):
        raise RuntimeError("test audit unavailable")

    monkeypatch.setattr(audit, "record_platform_audit", unavailable)
    with TestClient(env["client"].app, raise_server_exceptions=False) as client:
        client.cookies.update(env["client"].cookies)
        response = client.post(BASE + target, headers=headers, json=payload())
        assert response.status_code == 500
        assert response.headers.get("cache-control") == "private, no-store"
    assert snapshot(env) == before


def test_effective_household_api_follows_owner_controls(owner_env):
    env = owner_env
    headers = login(env)
    with TestClient(env["client"].app) as household_client:
        response = household_client.post("/chore-api/auth/login", json={"email": "owner@example.com", "password": "fixture-password"})
        assert response.status_code == 200
        assert "recipes" in {item["key"] for item in household_client.get("/chore-api/modules/me").json()["modules"]}
        response = env["client"].post(BASE + "/modules/recipes", headers=headers, json=payload())
        assert response.status_code == 200
        assert "recipes" not in {item["key"] for item in household_client.get("/chore-api/modules/me").json()["modules"]}
        assert env["client"].get("/chore-api/children?household_id=101").status_code == 401
        assert env["client"].post(BASE + "/modules/recipes", headers=headers, json=payload(True, False)).status_code == 200
        assert "recipes" in {item["key"] for item in household_client.get("/chore-api/modules/me").json()["modules"]}


def test_released_family_tree_keeps_explicit_household_opt_in_and_adult_boundary(owner_env):
    env = owner_env
    headers = login(env)
    before = snapshot(env)
    tree = module_by_key(env["client"].get(BASE + "/modules"), "family-tree")
    assert tree["can_enable"] and not tree["enabled"]
    response = env["client"].post(BASE + "/modules/family-tree", headers=headers,
                                  json=payload(True, False))
    assert response.status_code == 200, response.text
    assert response.json()["enabled"] and response.json()["restriction"] is None
    state = module_by_key(env["client"].get(BASE + "/households/101/modules"), "family-tree")
    assert state["can_enable"] and state["globally_enabled"]
    assert not state["enabled"] and not state["effective_enabled"]
    with env["sf"]() as db:
        assert not ModuleService().can_access_module(db, db.get(User, 201), "family-tree")
    response = env["client"].post(BASE + "/households/101/modules/family-tree",
                                  headers=headers, json=payload(True, False))
    assert response.status_code == 200 and response.json()["effective_enabled"]
    with env["sf"]() as db:
        service = ModuleService()
        assert service.can_access_module(db, db.get(User, 201), "family-tree")
        assert not service.can_access_module(db, db.get(User, 205), "family-tree")
        other = db.get(HouseholdModuleAccess, (102, "family-tree"))
        assert other is None or not other.enabled
    after = snapshot(env)
    for table in ("users", "households", "user_module_access"):
        assert after[table] == before[table]
