from __future__ import annotations

import base64
from datetime import UTC, datetime
import hashlib
import hmac
import secrets
import struct
import time


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def totp_code(secret: str, *, at: datetime | None = None) -> str:
    moment = at.timestamp() if at else time.time()
    counter = int(moment // 30)
    padded = secret.upper() + "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(padded)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{value:06d}"


def verify_totp(secret: str, code: str, *, now: datetime | None = None) -> bool:
    current = now or datetime.now(UTC)
    return len(code) == 6 and code.isdigit() and any(
        hmac.compare_digest(totp_code(secret, at=current.replace(microsecond=0) + __import__("datetime").timedelta(seconds=offset)), code)
        for offset in (-30, 0, 30)
    )
