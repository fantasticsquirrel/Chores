from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerificationError

_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a stored Argon2 hash."""
    try:
        return _password_hasher.verify(password_hash, password)
    except (InvalidHash, VerificationError):
        return False


def needs_rehash(password_hash: str) -> bool:
    """Return True when a stored hash should be upgraded to current parameters."""
    try:
        return _password_hasher.check_needs_rehash(password_hash)
    except InvalidHash:
        return True
