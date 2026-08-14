"""Capture one real reset-worker message for isolated Playwright smoke only.

This test bridge is not an operational mail command. It refuses any database
outside the managed disposable Playwright directory and returns the opaque
capability only to its caller's transient process memory.
"""

from __future__ import annotations

import argparse
from email import policy
from email.parser import BytesParser
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
from typing import Sequence

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import select  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import get_session_factory  # noqa: E402
from app.models.core import PasswordReset, PasswordResetDelivery, User  # noqa: E402
from app.models.enums import UserRole  # noqa: E402
from app.services.password_reset_mail import PasswordResetMailWorker  # noqa: E402
from app.services.password_resets import normalize_recovery_email  # noqa: E402
from app.smoke_safety import canonical_isolated_smoke_database_url, require_isolated_smoke_database  # noqa: E402

_TOKEN_PATTERN = re.compile(r"^https://family\.multihost\.ing/chore/reset-password#token=([A-Za-z0-9._~-]{1,1024})$")
_CLAIMABLE_STATUSES = ("pending", "retry")
_DEDICATED_RESULT_FD = 3


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Capture one Family Manager reset email from the disposable Playwright outbox."
    )
    parser.add_argument("--email", required=True, help="Eligible isolated parent account whose pending reset will be captured.")
    return parser.parse_args(argv)


def _require_no_mailbox_artifacts(database_path: Path) -> None:
    """Keep raw reset capabilities only in the caller's transient memory."""
    managed_directory = database_path.parent.resolve()
    temporary_root = Path(tempfile.gettempdir()).resolve()
    try:
        managed_directory.relative_to(temporary_root)
    except ValueError as exc:
        raise RuntimeError("The managed Playwright database must remain under the temporary directory.") from exc
    if any(managed_directory.glob("controlled-password-reset-mailbox.*")):
        raise RuntimeError("The isolated reset bridge does not permit mailbox artifacts.")


def _extract_token(raw_message: bytes, *, recipient: str) -> str:
    message = BytesParser(policy=policy.default).parsebytes(raw_message)
    if message.get("To") != recipient:
        raise RuntimeError("Captured local mailbox message did not match the isolated parent.")

    bodies = [
        body.get_content()
        for body in (
            message.get_body(preferencelist=("plain",)),
            message.get_body(preferencelist=("html",)),
        )
        if body is not None
    ]
    reset_urls = {
        match.group(0)
        for body in bodies
        for candidate in re.findall(r"https?://[^\s<>\"']+", body)
        if (match := _TOKEN_PATTERN.fullmatch(candidate.rstrip(".,;:!?"))) is not None
    }
    if len(reset_urls) != 1:
        raise RuntimeError("Captured local mailbox message did not contain exactly one exact public reset route.")
    return _TOKEN_PATTERN.fullmatch(reset_urls.pop()).group(1)  # type: ignore[union-attr]


def capture_pending_reset(*, email: str) -> str:
    """Run the real worker and return its capability only in transient memory."""
    settings = get_settings()
    database_url = canonical_isolated_smoke_database_url(settings.database_url)
    database_path = require_isolated_smoke_database(database_url)
    _require_no_mailbox_artifacts(database_path)
    normalized_email = normalize_recovery_email(email)
    if normalized_email is None:
        raise RuntimeError("No eligible isolated parent account is available.")

    factory = get_session_factory(database_url)
    with factory() as session:
        user = session.scalar(select(User).where(User.email == normalized_email))
        if user is None or not user.active or user.role not in {UserRole.PARENT, UserRole.PARENT_ADMIN}:
            raise RuntimeError("No eligible isolated parent account is available.")
        candidate_ids = list(
            session.scalars(
                select(PasswordResetDelivery.id)
                .join(PasswordReset, PasswordReset.id == PasswordResetDelivery.password_reset_id)
                .where(
                    PasswordResetDelivery.kind == "reset_link",
                    PasswordResetDelivery.status.in_(_CLAIMABLE_STATUSES),
                )
                .order_by(PasswordResetDelivery.id)
            ).all()
        )
        expected_ids = list(
            session.scalars(
                select(PasswordResetDelivery.id)
                .join(PasswordReset, PasswordReset.id == PasswordResetDelivery.password_reset_id)
                .where(
                    PasswordReset.user_id == user.id,
                    PasswordResetDelivery.kind == "reset_link",
                    PasswordResetDelivery.status.in_(_CLAIMABLE_STATUSES),
                )
                .order_by(PasswordResetDelivery.id)
            ).all()
        )
    if len(candidate_ids) != 1 or candidate_ids != expected_ids:
        raise RuntimeError("The isolated reset outbox did not contain exactly one requested pending delivery.")

    captured: list[bytes] = []
    worker = PasswordResetMailWorker(settings=settings, submit=captured.append)
    counts = worker.process_pending(limit=1)
    if counts != {"accepted": 1} or len(captured) != 1:
        raise RuntimeError("The isolated reset outbox could not be captured.")

    reset_token = _extract_token(captured[0], recipient=normalized_email)
    return reset_token


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    # The raw capability crosses only a dedicated inherited pipe. It is never
    # placed in stdout/stderr, disk, environment, or a loggable command line.
    raw_fd = os.getenv("PLAYWRIGHT_PASSWORD_RESET_RESULT_FD", "").strip()
    if raw_fd != str(_DEDICATED_RESULT_FD):
        raise RuntimeError("A dedicated result pipe is required for the isolated reset bridge.")
    try:
        descriptor = os.fstat(_DEDICATED_RESULT_FD)
    except OSError as exc:
        raise RuntimeError("A dedicated result pipe is required for the isolated reset bridge.") from exc
    # Node implements `stdio[3]: "pipe"` as a Unix-domain socketpair on this
    # platform, while direct test harnesses may use a FIFO. Both are dedicated
    # one-way IPC channels; reject regular files and inherited stdio streams.
    if not (stat.S_ISFIFO(descriptor.st_mode) or stat.S_ISSOCK(descriptor.st_mode)):
        raise RuntimeError("A dedicated result pipe is required for the isolated reset bridge.")
    os.write(_DEDICATED_RESULT_FD, capture_pending_reset(email=args.email).encode("ascii"))


if __name__ == "__main__":
    main()
