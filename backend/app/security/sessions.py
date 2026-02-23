from __future__ import annotations

from itsdangerous import BadSignature, URLSafeSerializer

SESSION_COOKIE_NAME = "chore_tracker_session"
SESSION_COOKIE_SALT = "chore-tracker-session"


def _serializer(secret_key: str) -> URLSafeSerializer:
    return URLSafeSerializer(secret_key=secret_key, salt=SESSION_COOKIE_SALT)


def create_session_token(secret_key: str, user_id: int) -> str:
    serializer = _serializer(secret_key)
    return serializer.dumps({"user_id": user_id})


def parse_session_token(secret_key: str, token: str) -> int | None:
    serializer = _serializer(secret_key)
    try:
        payload = serializer.loads(token)
    except BadSignature:
        return None

    user_id = payload.get("user_id")
    if not isinstance(user_id, int) or user_id <= 0:
        return None

    return user_id
