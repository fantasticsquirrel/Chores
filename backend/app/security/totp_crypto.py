from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from app.config import SettingsError, get_settings


def _key(version: str) -> bytes:
    value = dict(get_settings().platform_totp_encryption_keys).get(version)
    if value is None:
        raise SettingsError(f"Unknown platform TOTP encryption key version: {version}")
    return value.encode()


def encrypt_totp_secret(secret: str) -> str:
    version = get_settings().platform_totp_active_key_version
    if not version:
        raise SettingsError("PLATFORM_TOTP_ACTIVE_KEY_VERSION is required.")
    return Fernet(_key(version)).encrypt(secret.encode()).decode()


def decrypt_totp_secret(ciphertext: str, version: str) -> str:
    try:
        return Fernet(_key(version)).decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Invalid encrypted TOTP secret.") from exc