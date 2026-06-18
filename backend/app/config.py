from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


class SettingsError(ValueError):
    """Raised when configuration is invalid."""


@dataclass(frozen=True)
class Settings:
    app_env: str
    database_url: str
    secret_key: str
    log_level: str
    session_cookie_secure: bool
    push_vapid_public_key: str = ""
    push_vapid_private_key: str = ""
    push_vapid_claims_sub: str = "mailto:admin@multihost.ing"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


def _parse_bool(value: str, *, field_name: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise SettingsError(f"{field_name} must be a boolean-like string.")


def _default_cookie_secure(app_env: str) -> bool:
    return app_env == "production"


def _default_database_url() -> str:
    repo_root = Path(__file__).resolve().parents[2]
    return f"sqlite:///{repo_root / 'data' / 'chore_tracking.db'}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    if app_env not in {"development", "test", "production"}:
        raise SettingsError("APP_ENV must be one of development, test, production.")

    database_url = os.getenv("DATABASE_URL", _default_database_url()).strip()
    if not database_url:
        raise SettingsError("DATABASE_URL must not be empty.")

    secret_key = os.getenv("SECRET_KEY", "dev-secret-key-change-me").strip()
    if app_env == "production" and len(secret_key) < 32:
        raise SettingsError("SECRET_KEY must be at least 32 chars in production.")

    log_level = os.getenv("LOG_LEVEL", "INFO").strip().upper()
    if log_level not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
        raise SettingsError("LOG_LEVEL must be a valid standard logging level.")

    session_cookie_secure_raw = os.getenv("SESSION_COOKIE_SECURE")
    if session_cookie_secure_raw is None:
        session_cookie_secure = _default_cookie_secure(app_env)
    else:
        session_cookie_secure = _parse_bool(
            session_cookie_secure_raw,
            field_name="SESSION_COOKIE_SECURE",
        )

    return Settings(
        app_env=app_env,
        database_url=database_url,
        secret_key=secret_key,
        log_level=log_level,
        session_cookie_secure=session_cookie_secure,
        push_vapid_public_key=os.getenv("PUSH_VAPID_PUBLIC_KEY", "").strip(),
        push_vapid_private_key=os.getenv("PUSH_VAPID_PRIVATE_KEY", "").strip(),
        push_vapid_claims_sub=os.getenv("PUSH_VAPID_CLAIMS_SUB", "mailto:admin@multihost.ing").strip(),
    )
