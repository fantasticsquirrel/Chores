from __future__ import annotations

import hashlib
import hmac

from app.security.password_resets import (
    PasswordResetTokenError,
    derive_password_reset_proof,
    parse_password_reset_token,
)

_PROOF_DOMAIN = b"family-manager.registration.proof.v1\0"
_DIGEST_DOMAIN = b"family-manager.registration.digest.v1\0"


def format_registration_token(registration_id: str, *, key_version: str, token_keys) -> str:
    # Reuse the well-tested token grammar, but domain-separate registration proof.
    key = dict(token_keys).get(key_version)
    if key is None:
        raise PasswordResetTokenError("Registration token key unavailable.")
    # Validate identifier/version shapes without exposing the password-reset proof.
    derive_password_reset_proof(registration_id, key_version=key_version, token_keys=token_keys)
    proof = hmac.new(key.encode(), _PROOF_DOMAIN + registration_id.encode("ascii"), hashlib.sha256).digest()
    import base64
    return f"{key_version}.{registration_id}.{base64.urlsafe_b64encode(proof).decode().rstrip('=')}"


def digest_registration_token(token: str, *, key_version: str, token_keys) -> str:
    key = dict(token_keys).get(key_version)
    if key is None:
        raise PasswordResetTokenError("Registration token key unavailable.")
    return hmac.new(key.encode(), _DIGEST_DOMAIN + token.encode("ascii"), hashlib.sha256).hexdigest()


def parse_registration_token(token: str) -> tuple[str, str, str]:
    return parse_password_reset_token(token)
