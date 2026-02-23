from __future__ import annotations

from app.config import SettingsError, get_settings
import pytest


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_get_settings_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    monkeypatch.delenv("SESSION_COOKIE_SECURE", raising=False)

    settings = get_settings()

    assert settings.app_env == "development"
    assert settings.database_url == "sqlite:///./data/chore_tracking.db"
    assert settings.session_cookie_secure is False


def test_production_requires_long_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "too-short")

    with pytest.raises(SettingsError, match="at least 32 chars"):
        get_settings()


def test_invalid_cookie_value_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "sometimes")

    with pytest.raises(SettingsError, match="boolean-like"):
        get_settings()
