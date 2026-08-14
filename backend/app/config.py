from __future__ import annotations

import base64
import hashlib
import os
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


class SettingsError(ValueError):
    """Raised when configuration is invalid."""


_KEY_VERSION_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


@dataclass(frozen=True)
class Settings:
    app_env: str
    database_url: str
    secret_key: str
    log_level: str
    session_cookie_secure: bool
    session_max_age_seconds: int = 60 * 60 * 24 * 14
    login_max_attempts: int = 5
    login_window_seconds: int = 300
    platform_totp_encryption_keys: tuple[tuple[str, str], ...] = ()
    platform_totp_active_key_version: str = ""
    push_vapid_public_key: str = ""
    push_vapid_private_key: str = ""
    push_vapid_claims_sub: str = "mailto:admin@multihost.ing"
    # Password reset is deliberately disabled until the host-side MTA and DNS
    # prerequisites have been reviewed and activated.
    password_reset_enabled: bool = False
    password_reset_public_app_url: str = "https://family.multihost.ing/chore"
    password_reset_from_address: str = "no-reply@family.multihost.ing"
    password_reset_token_keys: tuple[tuple[str, str], ...] = ()
    password_reset_active_token_key_version: str = ""
    password_reset_rate_limit_pepper: str = ""
    password_reset_token_ttl_seconds: int = 15 * 60
    password_reset_account_cooldown_seconds: int = 15 * 60
    password_reset_account_daily_limit: int = 3
    password_reset_ip_window_seconds: int = 15 * 60
    password_reset_ip_window_limit: int = 5
    password_reset_ip_daily_limit: int = 20
    password_reset_household_daily_limit: int = 8
    password_reset_sendmail_path: str = "/usr/sbin/sendmail"
    password_reset_sendmail_timeout_seconds: int = 5
    password_reset_worker_batch_size: int = 20
    password_reset_delivery_lease_seconds: int = 120
    password_reset_delivery_max_attempts: int = 3
    password_reset_retention_days: int = 30
    password_reset_response_floor_ms: int = 100
    # Set only by the disposable browser-smoke wrapper. This is deliberately
    # non-operational and must be rejected at startup outside that harness.
    playwright_smoke_run_id: str = ""

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


def _parse_positive_int(raw: str, *, field_name: str) -> int:
    try:
        value = int(raw)
    except ValueError as exc:
        raise SettingsError(f"{field_name} must be a positive integer.") from exc
    if value <= 0:
        raise SettingsError(f"{field_name} must be a positive integer.")
    return value


def _parse_key_ring(raw: str, *, field_name: str) -> tuple[tuple[str, str], ...]:
    keys: list[tuple[str, str]] = []
    versions: set[str] = set()
    for item in filter(None, raw.split(",")):
        version, separator, key = item.strip().partition(":")
        if not separator or not _KEY_VERSION_PATTERN.fullmatch(version) or len(key) < 32:
            raise SettingsError(f"{field_name} must contain version:key entries with 32+ character keys.")
        if version in versions:
            raise SettingsError(f"{field_name} must not repeat a key version.")
        versions.add(version)
        keys.append((version, key))
    return tuple(keys)


def _development_key(secret_key: str, *, purpose: str) -> str:
    """Produce deterministic non-production defaults, never production secrets."""
    return base64.urlsafe_b64encode(
        hashlib.sha256(f"{purpose}\0{secret_key}".encode("utf-8")).digest()
    ).decode("ascii")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    if app_env not in {"development", "test", "production"}:
        raise SettingsError("APP_ENV must be one of development, test, production.")

    database_url = os.getenv("DATABASE_URL", _default_database_url()).strip()
    if not database_url:
        raise SettingsError("DATABASE_URL must not be empty.")
    # The disposable browser-smoke harness must open exactly the filename that
    # passed its containment checks, never a raw SQLite URI with different
    # query/encoding semantics at connection time.
    if os.getenv("PLAYWRIGHT_ISOLATED_DB") == "1":
        from app.smoke_safety import canonical_isolated_smoke_database_url

        try:
            database_url = canonical_isolated_smoke_database_url(database_url)
        except RuntimeError as exc:
            raise SettingsError(str(exc)) from exc

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

    session_max_age_seconds = _parse_positive_int(
        os.getenv("SESSION_MAX_AGE_SECONDS", str(60 * 60 * 24 * 14)),
        field_name="SESSION_MAX_AGE_SECONDS",
    )
    login_max_attempts = _parse_positive_int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"), field_name="LOGIN_MAX_ATTEMPTS")
    login_window_seconds = _parse_positive_int(os.getenv("LOGIN_WINDOW_SECONDS", "300"), field_name="LOGIN_WINDOW_SECONDS")

    if app_env == "production" and not session_cookie_secure:
        raise SettingsError("SESSION_COOKIE_SECURE must be true in production.")

    raw_totp_keys = os.getenv("PLATFORM_TOTP_ENCRYPTION_KEYS", "").strip()
    totp_keys = _parse_key_ring(raw_totp_keys, field_name="PLATFORM_TOTP_ENCRYPTION_KEYS")
    active_totp_version = os.getenv("PLATFORM_TOTP_ACTIVE_KEY_VERSION", "").strip()
    if app_env != "production" and not totp_keys and not active_totp_version:
        totp_keys = (("development", _development_key(secret_key, purpose="platform-totp")),)
        active_totp_version = "development"
    if active_totp_version and active_totp_version not in dict(totp_keys):
        raise SettingsError("PLATFORM_TOTP_ACTIVE_KEY_VERSION is not configured.")
    if app_env == "production" and (not totp_keys or not active_totp_version):
        raise SettingsError("PLATFORM_TOTP_ENCRYPTION_KEYS and PLATFORM_TOTP_ACTIVE_KEY_VERSION are required in production.")

    password_reset_enabled_raw = os.getenv("PASSWORD_RESET_ENABLED", "false")
    password_reset_enabled = _parse_bool(password_reset_enabled_raw, field_name="PASSWORD_RESET_ENABLED")
    password_reset_public_app_url = os.getenv(
        "PASSWORD_RESET_PUBLIC_APP_URL", "https://family.multihost.ing/chore"
    ).strip()
    password_reset_from_address = os.getenv(
        "PASSWORD_RESET_FROM_ADDRESS", "no-reply@family.multihost.ing"
    ).strip()
    raw_reset_keys = os.getenv("PASSWORD_RESET_TOKEN_KEYS", "").strip()
    password_reset_token_keys = _parse_key_ring(raw_reset_keys, field_name="PASSWORD_RESET_TOKEN_KEYS")
    password_reset_active_token_key_version = os.getenv("PASSWORD_RESET_ACTIVE_TOKEN_KEY_VERSION", "").strip()
    password_reset_rate_limit_pepper = os.getenv("PASSWORD_RESET_RATE_LIMIT_PEPPER", "").strip()
    if app_env != "production" and not password_reset_token_keys and not password_reset_active_token_key_version:
        password_reset_token_keys = (("development", _development_key(secret_key, purpose="password-reset-token")),)
        password_reset_active_token_key_version = "development"
    if app_env != "production" and not password_reset_rate_limit_pepper:
        password_reset_rate_limit_pepper = _development_key(secret_key, purpose="password-reset-rate-limit")
    if password_reset_active_token_key_version and password_reset_active_token_key_version not in dict(password_reset_token_keys):
        raise SettingsError("PASSWORD_RESET_ACTIVE_TOKEN_KEY_VERSION is not configured.")
    if password_reset_enabled and app_env == "production":
        if not password_reset_token_keys or not password_reset_active_token_key_version:
            raise SettingsError("PASSWORD_RESET_TOKEN_KEYS and PASSWORD_RESET_ACTIVE_TOKEN_KEY_VERSION are required when enabled.")
        if len(password_reset_rate_limit_pepper) < 32:
            raise SettingsError("PASSWORD_RESET_RATE_LIMIT_PEPPER must be at least 32 characters when enabled.")

    return Settings(
        app_env=app_env,
        database_url=database_url,
        secret_key=secret_key,
        log_level=log_level,
        session_cookie_secure=session_cookie_secure,
        session_max_age_seconds=session_max_age_seconds,
        login_max_attempts=login_max_attempts,
        login_window_seconds=login_window_seconds,
        platform_totp_encryption_keys=totp_keys,
        platform_totp_active_key_version=active_totp_version,
        push_vapid_public_key=os.getenv("PUSH_VAPID_PUBLIC_KEY", "").strip(),
        push_vapid_private_key=os.getenv("PUSH_VAPID_PRIVATE_KEY", "").strip(),
        push_vapid_claims_sub=os.getenv("PUSH_VAPID_CLAIMS_SUB", "mailto:admin@multihost.ing").strip(),
        password_reset_enabled=password_reset_enabled,
        password_reset_public_app_url=password_reset_public_app_url,
        password_reset_from_address=password_reset_from_address,
        password_reset_token_keys=password_reset_token_keys,
        password_reset_active_token_key_version=password_reset_active_token_key_version,
        password_reset_rate_limit_pepper=password_reset_rate_limit_pepper,
        password_reset_token_ttl_seconds=_parse_positive_int(
            os.getenv("PASSWORD_RESET_TOKEN_TTL_SECONDS", "900"), field_name="PASSWORD_RESET_TOKEN_TTL_SECONDS"
        ),
        password_reset_account_cooldown_seconds=_parse_positive_int(
            os.getenv("PASSWORD_RESET_ACCOUNT_COOLDOWN_SECONDS", "900"),
            field_name="PASSWORD_RESET_ACCOUNT_COOLDOWN_SECONDS",
        ),
        password_reset_account_daily_limit=_parse_positive_int(
            os.getenv("PASSWORD_RESET_ACCOUNT_DAILY_LIMIT", "3"), field_name="PASSWORD_RESET_ACCOUNT_DAILY_LIMIT"
        ),
        password_reset_ip_window_seconds=_parse_positive_int(
            os.getenv("PASSWORD_RESET_IP_WINDOW_SECONDS", "900"), field_name="PASSWORD_RESET_IP_WINDOW_SECONDS"
        ),
        password_reset_ip_window_limit=_parse_positive_int(
            os.getenv("PASSWORD_RESET_IP_WINDOW_LIMIT", "5"), field_name="PASSWORD_RESET_IP_WINDOW_LIMIT"
        ),
        password_reset_ip_daily_limit=_parse_positive_int(
            os.getenv("PASSWORD_RESET_IP_DAILY_LIMIT", "20"), field_name="PASSWORD_RESET_IP_DAILY_LIMIT"
        ),
        password_reset_household_daily_limit=_parse_positive_int(
            os.getenv("PASSWORD_RESET_HOUSEHOLD_DAILY_LIMIT", "8"),
            field_name="PASSWORD_RESET_HOUSEHOLD_DAILY_LIMIT",
        ),
        password_reset_sendmail_path=os.getenv("PASSWORD_RESET_SENDMAIL_PATH", "/usr/sbin/sendmail").strip(),
        password_reset_sendmail_timeout_seconds=_parse_positive_int(
            os.getenv("PASSWORD_RESET_SENDMAIL_TIMEOUT_SECONDS", "5"),
            field_name="PASSWORD_RESET_SENDMAIL_TIMEOUT_SECONDS",
        ),
        password_reset_worker_batch_size=_parse_positive_int(
            os.getenv("PASSWORD_RESET_WORKER_BATCH_SIZE", "20"), field_name="PASSWORD_RESET_WORKER_BATCH_SIZE"
        ),
        password_reset_delivery_lease_seconds=_parse_positive_int(
            os.getenv("PASSWORD_RESET_DELIVERY_LEASE_SECONDS", "120"),
            field_name="PASSWORD_RESET_DELIVERY_LEASE_SECONDS",
        ),
        password_reset_delivery_max_attempts=_parse_positive_int(
            os.getenv("PASSWORD_RESET_DELIVERY_MAX_ATTEMPTS", "3"),
            field_name="PASSWORD_RESET_DELIVERY_MAX_ATTEMPTS",
        ),
        password_reset_retention_days=_parse_positive_int(
            os.getenv("PASSWORD_RESET_RETENTION_DAYS", "30"), field_name="PASSWORD_RESET_RETENTION_DAYS"
        ),
        password_reset_response_floor_ms=_parse_positive_int(
            os.getenv("PASSWORD_RESET_RESPONSE_FLOOR_MS", "100"), field_name="PASSWORD_RESET_RESPONSE_FLOOR_MS"
        ),
        playwright_smoke_run_id=os.getenv("PLAYWRIGHT_SMOKE_RUN_ID", "").strip(),
    )
