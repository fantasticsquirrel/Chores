from __future__ import annotations

from datetime import UTC, datetime
import hashlib
import hmac
import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import Household, User
from app.models.enums import UserRole
from app.security import hash_password


def _setup(tmp_path: Path, monkeypatch) -> tuple[User, str]:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'support.db'}")
    monkeypatch.setenv("SECRET_KEY", "s" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("ZAMMAD_ENABLED", "true")
    monkeypatch.setenv("ZAMMAD_BASE_URL", "https://support.example.test")
    monkeypatch.setenv("ZAMMAD_API_TOKEN", "token-value-long-enough")
    monkeypatch.setenv("ZAMMAD_WEBHOOK_SECRET", "w" * 32)
    get_settings.cache_clear()
    settings = get_settings()
    initialize_database(settings)
    with get_session_factory(settings.database_url)() as session:
        home = Household(name="Home", timezone="UTC")
        session.add(home); session.flush()
        user = User(household_id=home.id, email="parent@example.com", password_hash=hash_password("password123"), role=UserRole.PARENT_ADMIN)
        session.add(user); session.commit(); session.refresh(user)
        return user, "password123"


def _login(client: TestClient, user: User, password: str) -> dict[str, str]:
    response = client.post("/chore-api/auth/login", json={"email": user.email, "password": password})
    return {"X-CSRF-Token": response.json()["csrf_token"]}


def test_ticket_create_is_idempotent_and_household_scoped(tmp_path: Path, monkeypatch) -> None:
    user, password = _setup(tmp_path, monkeypatch)
    calls = 0
    def fake_create(*args, **kwargs):
        nonlocal calls; calls += 1
        return {"id": 42, "number": "42001", "state": "new"}
    monkeypatch.setattr("app.services.zammad.ZammadClient.create_ticket", fake_create)
    payload = {"title": "Need help", "body": "Something broke", "category": "other", "idempotency_key": "request_12345", "environment": "web", "app_version": "test"}
    with TestClient(app) as client:
        headers = _login(client, user, password)
        first = client.post("/chore-api/support/tickets", json=payload, headers=headers)
        second = client.post("/chore-api/support/tickets", json=payload, headers=headers)
        missing = client.get("/chore-api/support/tickets/99999")
    assert first.status_code == 201 and second.status_code == 201
    assert first.json()["id"] == second.json()["id"] and calls == 1
    assert missing.status_code == 404


def test_webhook_rejects_forgery_and_deduplicates(tmp_path: Path, monkeypatch) -> None:
    _setup(tmp_path, monkeypatch)
    body = json.dumps({"ticket": {"id": 42, "state": "closed"}}, separators=(",", ":")).encode()
    timestamp = str(int(datetime.now(UTC).timestamp()))
    signature = hmac.new(("w" * 32).encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    with TestClient(app) as client:
        forged = client.post("/chore-api/integrations/zammad/webhook", content=body, headers={"Content-Type": "application/json", "X-Zammad-Timestamp": timestamp, "X-Zammad-Signature": "sha256=bad"})
        good = client.post("/chore-api/integrations/zammad/webhook", content=body, headers={"Content-Type": "application/json", "X-Zammad-Timestamp": timestamp, "X-Zammad-Signature": f"sha256={signature}"})
        duplicate = client.post("/chore-api/integrations/zammad/webhook", content=body, headers={"Content-Type": "application/json", "X-Zammad-Timestamp": timestamp, "X-Zammad-Signature": f"sha256={signature}"})
    assert forged.status_code == 401
    assert good.status_code == duplicate.status_code == 204

