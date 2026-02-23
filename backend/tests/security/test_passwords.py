from __future__ import annotations

from app.security.passwords import hash_password, needs_rehash, verify_password


def test_hash_and_verify_password_round_trip() -> None:
    password = "super-secret-password"

    password_hash = hash_password(password)

    assert password_hash != password
    assert verify_password(password, password_hash) is True


def test_verify_password_rejects_invalid_password_and_hash() -> None:
    password_hash = hash_password("correct")

    assert verify_password("incorrect", password_hash) is False
    assert verify_password("anything", "not-a-real-hash") is False


def test_needs_rehash_returns_true_for_invalid_hash() -> None:
    assert needs_rehash("invalid-hash") is True
