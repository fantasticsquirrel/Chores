from __future__ import annotations

import secrets

CSRF_COOKIE_NAME = "chore_tracker_csrf"
CSRF_HEADER_NAME = "X-CSRF-Token"


def create_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def is_valid_csrf_token(cookie_token: str | None, header_token: str | None) -> bool:
    if cookie_token is None or header_token is None:
        return False
    return secrets.compare_digest(cookie_token, header_token)
