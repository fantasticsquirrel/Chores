from __future__ import annotations

import base64
import hashlib
import hmac
from pathlib import Path
from threading import BoundedSemaphore

import pytest

from app.config import Settings, SettingsError, get_settings
from app.security.password_resets import (
    PASSWORD_RESET_DIGEST_DOMAIN,
    PASSWORD_RESET_PROOF_DOMAIN,
    PasswordResetTokenKeyError,
    derive_password_reset_proof,
    digest_password_reset_token,
    format_password_reset_token,
    parse_password_reset_token,
    validate_password_reset_token,
)
from app.security import passwords as password_security
from app.security.passwords import (
    PARENT_PASSWORD_MIN_LENGTH,
    PasswordPolicyError,
    hash_parent_password,
    verify_password,
)
from app.startup import run_startup_checks


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_parent_password_policy_requires_fifteen_characters_and_keeps_argon2_hashing() -> None:
    assert PARENT_PASSWORD_MIN_LENGTH == 15

    with pytest.raises(PasswordPolicyError, match="at least 15 characters"):
        hash_parent_password("x" * (PARENT_PASSWORD_MIN_LENGTH - 1))

    password = "A password long enough"
    password_hash = hash_parent_password(password)

    assert password_hash.startswith("$argon2")
    assert verify_password(password, password_hash) is True


def test_reset_token_uses_domain_separated_hmacs_and_contains_no_database_secret() -> None:
    token_keys = (("v1", "retired-test-key-which-is-long-enough"),)
    reset_id = "random-reset-row-id"

    proof = derive_password_reset_proof(reset_id, key_version="v1", token_keys=token_keys)
    token = format_password_reset_token(reset_id, key_version="v1", token_keys=token_keys)
    digest = digest_password_reset_token(token, key_version="v1", token_keys=token_keys)

    expected_proof = base64.urlsafe_b64encode(
        hmac.new(
            b"retired-test-key-which-is-long-enough",
            PASSWORD_RESET_PROOF_DOMAIN + reset_id.encode("ascii"),
            hashlib.sha256,
        ).digest()
    ).decode("ascii").rstrip("=")
    expected_digest = hmac.new(
        b"retired-test-key-which-is-long-enough",
        PASSWORD_RESET_DIGEST_DOMAIN + token.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()

    assert proof == expected_proof
    assert token == f"v1.{reset_id}.{proof}"
    assert digest == expected_digest
    assert proof not in digest
    assert parse_password_reset_token(token) == ("v1", reset_id, proof)
    assert validate_password_reset_token(token, digest, token_keys=token_keys) is True


def test_retired_reset_key_validates_during_grace_and_fails_closed_after_removal() -> None:
    reset_id = "row-101"
    issued_keys = (("v1", "retired-test-key-which-is-long-enough"),)
    token = format_password_reset_token(reset_id, key_version="v1", token_keys=issued_keys)
    digest = digest_password_reset_token(token, key_version="v1", token_keys=issued_keys)

    keys_during_rotation = (
        ("v1", "retired-test-key-which-is-long-enough"),
        ("v2", "active-test-key-which-is-long-enough"),
    )
    assert validate_password_reset_token(token, digest, token_keys=keys_during_rotation) is True
    assert validate_password_reset_token(token, digest, token_keys=(("v2", "active-test-key-which-is-long-enough"),)) is False

    with pytest.raises(PasswordResetTokenKeyError, match="v3"):
        format_password_reset_token(reset_id, key_version="v3", token_keys=keys_during_rotation)


@pytest.mark.parametrize(
    "public_url,from_address,error",
    [
        ("http://family.multihost.ing/chore", "no-reply@family.multihost.ing", "PASSWORD_RESET_PUBLIC_APP_URL"),
        ("https://evil.example/chore", "no-reply@family.multihost.ing", "PASSWORD_RESET_PUBLIC_APP_URL"),
        ("https://family.multihost.ing/chore/", "no-reply@family.multihost.ing", "PASSWORD_RESET_PUBLIC_APP_URL"),
        ("https://family.multihost.ing/chore?next=/", "no-reply@family.multihost.ing", "PASSWORD_RESET_PUBLIC_APP_URL"),
        ("https://family.multihost.ing/chore", "support@family.multihost.ing", "PASSWORD_RESET_FROM_ADDRESS"),
    ],
)
def test_enabled_reset_startup_fails_closed_for_invalid_public_identity(
    tmp_path: Path,
    public_url: str,
    from_address: str,
    error: str,
) -> None:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{tmp_path / 'tracker.db'}",
        secret_key="s" * 32,
        log_level="INFO",
        session_cookie_secure=False,
        password_reset_enabled=True,
        password_reset_public_app_url=public_url,
        password_reset_from_address=from_address,
        password_reset_token_keys=(("v1", "t" * 32),),
        password_reset_active_token_key_version="v1",
        password_reset_rate_limit_pepper="r" * 32,
        password_reset_sendmail_path="/bin/true",
    )

    with pytest.raises(SettingsError, match=error):
        run_startup_checks(settings)


def test_enabled_reset_startup_accepts_only_complete_safe_configuration(tmp_path: Path) -> None:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{tmp_path / 'tracker.db'}",
        secret_key="s" * 32,
        log_level="INFO",
        session_cookie_secure=False,
        password_reset_enabled=True,
        password_reset_public_app_url="https://family.multihost.ing/chore",
        password_reset_from_address="no-reply@family.multihost.ing",
        password_reset_token_keys=(("v1", "t" * 32),),
        password_reset_active_token_key_version="v1",
        password_reset_rate_limit_pepper="r" * 32,
        password_reset_sendmail_path="/bin/true",
    )

    run_startup_checks(settings)


def test_enabled_reset_startup_rejects_an_expired_delivery_lease(tmp_path: Path) -> None:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{tmp_path / 'tracker.db'}",
        secret_key="s" * 32,
        log_level="INFO",
        session_cookie_secure=False,
        password_reset_enabled=True,
        password_reset_public_app_url="https://family.multihost.ing/chore",
        password_reset_from_address="no-reply@family.multihost.ing",
        password_reset_token_keys=(("v1", "t" * 32),),
        password_reset_active_token_key_version="v1",
        password_reset_rate_limit_pepper="r" * 32,
        password_reset_sendmail_path="/bin/true",
        password_reset_token_ttl_seconds=60,
        password_reset_delivery_lease_seconds=60,
    )

    with pytest.raises(SettingsError, match="PASSWORD_RESET_DELIVERY_LEASE_SECONDS"):
        run_startup_checks(settings)


def test_production_enabled_reset_requires_explicit_independent_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "s" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "true")
    monkeypatch.setenv("PLATFORM_TOTP_ENCRYPTION_KEYS", "v1:" + "p" * 32)
    monkeypatch.setenv("PLATFORM_TOTP_ACTIVE_KEY_VERSION", "v1")
    monkeypatch.setenv("PASSWORD_RESET_ENABLED", "true")
    monkeypatch.setenv("PASSWORD_RESET_PUBLIC_APP_URL", "https://family.multihost.ing/chore")
    monkeypatch.setenv("PASSWORD_RESET_FROM_ADDRESS", "no-reply@family.multihost.ing")
    monkeypatch.delenv("PASSWORD_RESET_TOKEN_KEYS", raising=False)
    monkeypatch.delenv("PASSWORD_RESET_ACTIVE_TOKEN_KEY_VERSION", raising=False)
    monkeypatch.delenv("PASSWORD_RESET_RATE_LIMIT_PEPPER", raising=False)

    with pytest.raises(SettingsError, match="PASSWORD_RESET_TOKEN_KEYS"):
        get_settings()


def test_reset_confirmation_timing_budget_skips_argon2_when_its_concurrency_budget_is_saturated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Every public confirmation must enter the bounded budget before Argon2."""
    calls: list[str] = []

    class _Hasher:
        def hash(self, value: str) -> str:
            calls.append(value)
            return "discarded"

    slots = BoundedSemaphore(1)
    monkeypatch.setattr(password_security, "_password_hasher", _Hasher())
    monkeypatch.setattr(password_security, "_password_reset_confirmation_slots", slots)

    assert password_security.acquire_password_reset_confirmation_budget() is True
    try:
        assert password_security.acquire_password_reset_confirmation_budget() is False
    finally:
        password_security.release_password_reset_confirmation_budget()

    assert calls == []
    assert password_security.acquire_password_reset_confirmation_budget() is True
    try:
        password_security.burn_password_reset_confirmation_timing_budget()
    finally:
        password_security.release_password_reset_confirmation_budget()
    assert calls == ["family-manager-reset-confirmation-timing-pad"]
