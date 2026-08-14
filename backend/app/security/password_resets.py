from __future__ import annotations

import base64
import hashlib
import hmac
import re
from collections.abc import Iterable

PASSWORD_RESET_PROOF_DOMAIN = b"family-manager.password-reset.proof.v1\0"
PASSWORD_RESET_DIGEST_DOMAIN = b"family-manager.password-reset.digest.v1\0"
_TOKEN_COMPONENT = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_PROOF_COMPONENT = re.compile(r"^[A-Za-z0-9_-]{43}$")


class PasswordResetTokenError(ValueError):
    """Raised only for internal token-shape failures; callers return generic errors."""


class PasswordResetTokenKeyError(PasswordResetTokenError):
    """Raised when trusted code attempts to use an unknown key version."""


def _key_for_version(
    key_version: str,
    token_keys: Iterable[tuple[str, str]],
) -> bytes:
    key = dict(token_keys).get(key_version)
    if key is None:
        raise PasswordResetTokenKeyError(f"Password reset token key version is unavailable: {key_version}")
    return key.encode("utf-8")


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def derive_password_reset_proof(
    reset_id: str,
    *,
    key_version: str,
    token_keys: Iterable[tuple[str, str]],
) -> str:
    """Derive the secret proof for a random reset row ID without persisting it."""
    if not _TOKEN_COMPONENT.fullmatch(reset_id):
        raise PasswordResetTokenError("Password reset identifier has an invalid shape.")
    key = _key_for_version(key_version, token_keys)
    return _base64url(hmac.new(key, PASSWORD_RESET_PROOF_DOMAIN + reset_id.encode("ascii"), hashlib.sha256).digest())


def format_password_reset_token(
    reset_id: str,
    *,
    key_version: str,
    token_keys: Iterable[tuple[str, str]],
) -> str:
    """Return the opaque user-facing capability; it is never written to storage."""
    if not _TOKEN_COMPONENT.fullmatch(key_version):
        raise PasswordResetTokenError("Password reset token version has an invalid shape.")
    proof = derive_password_reset_proof(reset_id, key_version=key_version, token_keys=token_keys)
    return f"{key_version}.{reset_id}.{proof}"


def parse_password_reset_token(token: str) -> tuple[str, str, str]:
    """Parse a capability without looking up state or revealing a failure reason."""
    if not isinstance(token, str) or len(token) > 1024:
        raise PasswordResetTokenError("Password reset token has an invalid shape.")
    parts = token.split(".")
    if len(parts) != 3:
        raise PasswordResetTokenError("Password reset token has an invalid shape.")
    key_version, reset_id, proof = parts
    if not _TOKEN_COMPONENT.fullmatch(key_version) or not _TOKEN_COMPONENT.fullmatch(reset_id) or not _PROOF_COMPONENT.fullmatch(proof):
        raise PasswordResetTokenError("Password reset token has an invalid shape.")
    return key_version, reset_id, proof


def digest_password_reset_token(
    token: str,
    *,
    key_version: str,
    token_keys: Iterable[tuple[str, str]],
) -> str:
    """Return the domain-separated keyed lookup digest for an opaque token."""
    key = _key_for_version(key_version, token_keys)
    return hmac.new(key, PASSWORD_RESET_DIGEST_DOMAIN + token.encode("ascii"), hashlib.sha256).hexdigest()


def validate_password_reset_token(
    token: str,
    expected_digest: str,
    *,
    token_keys: Iterable[tuple[str, str]],
) -> bool:
    """Validate proof and stored digest without throwing token detail to callers."""
    try:
        key_version, reset_id, proof = parse_password_reset_token(token)
        expected_proof = derive_password_reset_proof(reset_id, key_version=key_version, token_keys=token_keys)
        if not hmac.compare_digest(proof, expected_proof):
            return False
        candidate_digest = digest_password_reset_token(token, key_version=key_version, token_keys=token_keys)
    except (PasswordResetTokenError, UnicodeEncodeError):
        return False
    return hmac.compare_digest(candidate_digest, expected_digest)
