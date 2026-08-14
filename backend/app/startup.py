from __future__ import annotations

import os
from pathlib import Path
import re
from urllib.parse import urlparse

from app.config import Settings, SettingsError
from app.smoke_safety import require_isolated_smoke_database

PASSWORD_RESET_EXPECTED_ORIGIN = "https://family.multihost.ing"
PASSWORD_RESET_EXPECTED_PATH = "/chore"
PASSWORD_RESET_EXPECTED_FROM = "no-reply@family.multihost.ing"
_PLAYWRIGHT_SMOKE_RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{32,128}$")


def run_startup_checks(settings: Settings) -> None:
    _validate_security(settings)
    _validate_database_path(settings.database_url)


def _validate_security(settings: Settings) -> None:
    if settings.is_production and settings.secret_key == "dev-secret-key-change-me":
        raise SettingsError("SECRET_KEY must be overridden in production.")
    _validate_playwright_smoke_settings(settings)
    if settings.password_reset_enabled:
        _validate_password_reset_settings(settings)


def _validate_playwright_smoke_settings(settings: Settings) -> None:
    """Allow a readiness nonce only for the wrapper-owned disposable service."""
    run_id = settings.playwright_smoke_run_id
    if not run_id:
        return
    if settings.is_production:
        raise SettingsError("PLAYWRIGHT_SMOKE_RUN_ID is permitted only in a non-production smoke process.")
    if not _PLAYWRIGHT_SMOKE_RUN_ID_PATTERN.fullmatch(run_id):
        raise SettingsError("PLAYWRIGHT_SMOKE_RUN_ID must be a 32-128 character opaque nonce.")
    try:
        require_isolated_smoke_database(settings.database_url)
    except RuntimeError as exc:
        raise SettingsError(str(exc)) from exc


def _validate_password_reset_settings(settings: Settings) -> None:
    parsed = urlparse(settings.password_reset_public_app_url)
    if (
        parsed.scheme != "https"
        or parsed.netloc != "family.multihost.ing"
        or parsed.path != PASSWORD_RESET_EXPECTED_PATH
        or parsed.params
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
    ):
        raise SettingsError(
            "PASSWORD_RESET_PUBLIC_APP_URL must be exactly https://family.multihost.ing/chore without query, fragment, or credentials."
        )
    if settings.password_reset_from_address != PASSWORD_RESET_EXPECTED_FROM:
        raise SettingsError("PASSWORD_RESET_FROM_ADDRESS must be no-reply@family.multihost.ing.")
    key_ring = dict(settings.password_reset_token_keys)
    if not key_ring or not settings.password_reset_active_token_key_version:
        raise SettingsError("PASSWORD_RESET_TOKEN_KEYS and PASSWORD_RESET_ACTIVE_TOKEN_KEY_VERSION are required when enabled.")
    if settings.password_reset_active_token_key_version not in key_ring:
        raise SettingsError("PASSWORD_RESET_ACTIVE_TOKEN_KEY_VERSION is not configured.")
    if len(settings.password_reset_rate_limit_pepper) < 32:
        raise SettingsError("PASSWORD_RESET_RATE_LIMIT_PEPPER must be at least 32 characters when enabled.")
    if settings.password_reset_rate_limit_pepper in key_ring.values():
        raise SettingsError("PASSWORD_RESET_RATE_LIMIT_PEPPER must be independent from PASSWORD_RESET_TOKEN_KEYS.")
    if settings.password_reset_delivery_lease_seconds >= settings.password_reset_token_ttl_seconds:
        raise SettingsError("PASSWORD_RESET_DELIVERY_LEASE_SECONDS must be shorter than PASSWORD_RESET_TOKEN_TTL_SECONDS.")
    sendmail = Path(settings.password_reset_sendmail_path)
    if not sendmail.is_absolute() or not sendmail.is_file() or not os.access(sendmail, os.X_OK):
        raise SettingsError("PASSWORD_RESET_SENDMAIL_PATH must name an executable absolute local sendmail path when enabled.")


def _validate_database_path(database_url: str) -> None:
    parsed = urlparse(database_url)
    if parsed.scheme != "sqlite":
        return

    raw_path = parsed.path
    if database_url.startswith("sqlite:///./"):
        raw_path = database_url.replace("sqlite:///", "", 1)

    db_path = Path(raw_path).expanduser().resolve()
    db_dir = db_path.parent

    db_dir.mkdir(parents=True, exist_ok=True)
    if not os.access(db_dir, os.W_OK):
        raise SettingsError(f"Database directory is not writable: {db_dir}")
