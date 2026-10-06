"""Native registration security contracts; all values are disposable fixtures."""
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.main import app
from app.models import AuthSession, User
from app.security.csrf import CSRF_HEADER_NAME
from app.security.sessions import SESSION_COOKIE_NAME, hash_session_token
from test_notification_hardening import _configure, _seed

BASE = "/chore-api/push/native"
TOKEN = "ExpoPushToken[fixture-device_123]"


@pytest.fixture
def native(tmp_path, monkeypatch):
    _configure(tmp_path, monkeypatch)
    monkeypatch.setenv("NATIVE_PUSH_ENABLED", "true")
    monkeypatch.setenv("PUSH_VAPID_PRIVATE_KEY", "")
    get_settings.cache_clear()
    return _seed()


def login(client, native, email=None):
    result = client.post("/chore-api/auth/login", json={"email": email or native["parent_email"], "password": "password123"})
    assert result.status_code == 200
    return {CSRF_HEADER_NAME: result.json()["csrf_token"]}


def register(client, headers, token=TOKEN, **extra):
    return client.post(BASE + "/subscriptions", headers=headers, json={"token": token, "platform": "android", **extra})


def test_config_is_authenticated_disabled_by_default(native, monkeypatch):
    monkeypatch.delenv("NATIVE_PUSH_ENABLED")
    get_settings.cache_clear()
    with TestClient(app) as client:
        assert client.get(BASE + "/config").status_code == 401
        headers = login(client, native)
        assert client.get(BASE + "/config").json() == {"enabled": False}
        assert register(client, headers).status_code == 503
        assert client.get(BASE + "/subscriptions").json() == {"items": []}


def test_subscription_crud_is_current_session_only(native):
    from app.models import NativePushSubscription
    with TestClient(app) as first, TestClient(app) as second:
        headers = login(first, native)
        other_headers = login(second, native)
        assert first.get(BASE + "/config").json() == {"enabled": True}
        assert register(first, {}).status_code == 403
        result = register(first, headers)
        assert result.status_code == 201
        item = result.json()
        assert item == {"id": item["id"], "platform": "android", "enabled": True}
        assert register(first, headers).json() == item
        assert first.get(BASE + "/subscriptions").json() == {"items": [item]}
        assert second.get(BASE + "/subscriptions").json() == {"items": []}
        assert second.delete(BASE + f"/subscriptions/{item['id']}", headers=other_headers).status_code == 404
        assert first.delete(BASE + f"/subscriptions/{item['id']}").status_code == 403
        assert first.delete(BASE + f"/subscriptions/{item['id']}", headers=headers).status_code == 204
        assert first.get(BASE + "/subscriptions").json()["items"][0]["enabled"] is False
        with native["factory"]() as db:
            row = db.get(NativePushSubscription, item["id"])
            auth = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_session_token(first.cookies.get(SESSION_COOKIE_NAME))))
            assert row.session_id == auth.id
            assert row.user_id == native["parent_id"]


@pytest.mark.parametrize("payload", [
    {"token": "https://attacker.example/", "platform": "android"},
    {"token": "ExpoPushToken[]", "platform": "ios"},
    {"token": "ExpoPushToken[space value]", "platform": "ios"},
    {"token": "ExpoPushToken[" + "a" * 201 + "]", "platform": "ios"},
    {"token": TOKEN + "\n", "platform": "android"},
    {"token": TOKEN, "platform": "web"},
    {"token": TOKEN, "platform": "android", "user_id": 123},
    {"token": TOKEN, "platform": "android", "url": "https://attacker.example"},
])
def test_registration_rejects_bad_tokens_platform_and_unscoped_fields(native, payload):
    with TestClient(app) as client:
        headers = login(client, native)
        result = client.post(BASE + "/subscriptions", headers=headers, json=payload)
        assert result.status_code == 422
        assert TOKEN not in result.text
        assert client.get(BASE + "/subscriptions").json() == {"items": []}


@pytest.mark.parametrize("platform", ["android", "ios"])
@pytest.mark.parametrize("prefix", ["ExpoPushToken", "ExponentPushToken"])
def test_valid_bounded_native_tokens(native, platform, prefix):
    with TestClient(app) as client:
        headers = login(client, native)
        result = client.post(BASE + "/subscriptions", headers=headers, json={"token": prefix + "[abcDEF123_-]", "platform": platform})
        assert result.status_code == 201
        assert result.json()["platform"] == platform


@pytest.mark.parametrize("old_actor", ["same", "different"])
@pytest.mark.parametrize("invalidate", ["revoked", "expired", "generation"])
def test_token_conflicts_until_former_session_invalid_then_rebinds(native, old_actor, invalidate):
    from app.models import NativePushSubscription
    with TestClient(app) as first, TestClient(app) as second:
        first_headers = login(first, native)
        second_headers = login(second, native, email="child-hardening@example.test" if old_actor == "different" else None)
        old = register(first, first_headers).json()
        assert register(second, second_headers).status_code == 409
        # Disabling is not permission to steal a token still bound to a live session.
        first.delete(BASE + f"/subscriptions/{old['id']}", headers=first_headers)
        assert register(second, second_headers).status_code == 409
        with native["factory"]() as db:
            row = db.get(NativePushSubscription, old["id"])
            auth = db.get(AuthSession, row.session_id)
            if invalidate == "revoked":
                auth.revoked_at = datetime.now(UTC)
            elif invalidate == "expired":
                auth.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            else:
                auth.session_generation = -1
            db.commit()
        rebound = register(second, second_headers)
        assert rebound.status_code == 201
        assert rebound.json()["id"] == old["id"]
        assert rebound.json()["enabled"] is True
        assert first.delete(BASE + f"/subscriptions/{old['id']}", headers=first_headers).status_code in {401, 404}
        with native["factory"]() as db:
            assert len(db.scalars(select(NativePushSubscription)).all()) == 1


def test_cross_actor_list_and_delete_are_hidden(native):
    with TestClient(app) as parent, TestClient(app) as child:
        parent_headers = login(parent, native)
        child_headers = login(child, native, "child-hardening@example.test")
        item = register(parent, parent_headers).json()
        assert child.get(BASE + "/subscriptions").json() == {"items": []}
        assert child.delete(BASE + f"/subscriptions/{item['id']}", headers=child_headers).status_code == 404


def test_native_api_rejects_revoked_session(native):
    with TestClient(app) as client:
        headers = login(client, native)
        item = register(client, headers).json()
        client.post("/chore-api/auth/logout", headers=headers)
        assert client.get(BASE + "/config").status_code == 401
        assert register(client, headers).status_code == 401
        assert client.delete(BASE + f"/subscriptions/{item['id']}", headers=headers).status_code == 401
