from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.db import get_engine, get_session_factory, initialize_database
from app.main import app
from app.models.core import AccountRegistration
from app.security.registrations import format_registration_token
from app.services.registration_mail import RegistrationMailWorker


def configure(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'registration-api.db'}")
    monkeypatch.setenv("SECRET_KEY", "s" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("REGISTRATION_ENABLED", "true")
    monkeypatch.setenv("PASSWORD_RESET_SENDMAIL_PATH", "/bin/true")
    get_settings.cache_clear(); get_engine.cache_clear(); get_session_factory.cache_clear()
    initialize_database(get_settings())


def test_public_request_and_verify_create_owner(tmp_path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    with TestClient(app) as client:
        response = client.post("/chore-api/auth/registration/request", json={"email":"owner@example.com","password":"correct horse battery staple","household_name":"Our Home","timezone":"America/Chicago"})
        assert response.status_code == 202
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        row = session.scalar(select(AccountRegistration))
        assert row is not None
        token = format_registration_token(row.id, key_version=row.token_key_version, token_keys=get_settings().password_reset_token_keys)
    with TestClient(app) as client:
        response = client.post("/chore-api/auth/registration/verify", json={"token":token})
        assert response.status_code == 202
        assert client.post("/chore-api/auth/login", json={"email":"owner@example.com","password":"correct horse battery staple"}).status_code == 200


def test_registration_worker_submits_secret_only_in_memory(tmp_path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    with TestClient(app) as client:
        client.post("/chore-api/auth/registration/request", json={"email":"owner@example.com","password":"correct horse battery staple","household_name":"Our Home","timezone":"UTC"})
    messages: list[bytes] = []
    assert RegistrationMailWorker(settings=get_settings(), submit=messages.append).process_pending() == {"registration_accepted": 1}
    assert len(messages) == 1 and b"verify-email#token=" in messages[0]


def test_invalid_registration_never_reflects_password(tmp_path, monkeypatch) -> None:
    configure(tmp_path, monkeypatch)
    candidate = "password123"
    with TestClient(app) as client:
        response = client.post("/chore-api/auth/registration/request", json={"email":"owner@example.com","password":candidate,"household_name":"Our Home","timezone":"UTC"})
    assert response.status_code == 422
    assert candidate not in response.text
