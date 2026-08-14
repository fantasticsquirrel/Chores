from __future__ import annotations

from threading import BoundedSemaphore

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerificationError

PARENT_PASSWORD_MIN_LENGTH = 15
PASSWORD_MAX_LENGTH = 1024
_COMMON_PASSWORDS = frozenset(
    {
        "password",
        "password123",
        "123456789012345",
        "qwertyuiopasdfgh",
        "letmeinletmein",
    }
)


class PasswordPolicyError(ValueError):
    """Raised when a newly chosen parent password does not meet policy."""


_password_hasher = PasswordHasher()
# This fixed, non-user value makes unsuccessful public password-reset
# confirmations perform Argon2-class work comparable to a real password update.
# The resulting hash is discarded and never persists or reaches logs.
_PASSWORD_RESET_TIMING_PAD = "family-manager-reset-confirmation-timing-pad"
# A bounded, process-local admission budget applies to *every* public
# confirmation outcome, including a valid reset.  If it is saturated, the route
# performs no capability lookup or credential mutation and returns only the
# same public response floor.  That prevents unbounded Argon2 work without
# making a valid capability distinguishable from an invalid one under load.
_PASSWORD_RESET_CONFIRMATION_MAX_CONCURRENCY = 2
_password_reset_confirmation_slots = BoundedSemaphore(_PASSWORD_RESET_CONFIRMATION_MAX_CONCURRENCY)


def acquire_password_reset_confirmation_budget() -> bool:
    """Try to admit one public confirmation without queueing unbounded work."""
    return _password_reset_confirmation_slots.acquire(blocking=False)


def release_password_reset_confirmation_budget() -> None:
    """Release a confirmation admission slot acquired by this process."""
    _password_reset_confirmation_slots.release()


def burn_password_reset_confirmation_timing_budget() -> None:
    """Spend Argon2-class work for a rejected confirmation that was admitted.

    Callers hold the shared confirmation admission slot while invoking this
    function.  Keeping the budget outside the helper ensures valid and rejected
    confirmations are capped by the identical concurrency boundary.
    """
    _password_hasher.hash(_PASSWORD_RESET_TIMING_PAD)


def validate_parent_password(password: str) -> str:
    """Validate a new parent password without retaining or logging plaintext."""
    if not isinstance(password, str):
        raise PasswordPolicyError("Password must be text.")
    if len(password) < PARENT_PASSWORD_MIN_LENGTH:
        raise PasswordPolicyError(f"Password must be at least {PARENT_PASSWORD_MIN_LENGTH} characters.")
    if len(password) > PASSWORD_MAX_LENGTH:
        raise PasswordPolicyError(f"Password must be at most {PASSWORD_MAX_LENGTH} characters.")
    if password.casefold() in _COMMON_PASSWORDS:
        raise PasswordPolicyError("Choose a less common password.")
    return password


def hash_parent_password(password: str) -> str:
    """Validate and hash a newly chosen parent password using Argon2id."""
    return _password_hasher.hash(validate_parent_password(password))


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id for existing legacy flows."""
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
