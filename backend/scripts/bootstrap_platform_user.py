#!/usr/bin/env python3
"""Bootstrap a platform owner or support operator without provider credentials.

The password is read with getpass so it is not exposed in process arguments or
shell history. The TOTP secret is written atomically to a caller-selected
mode-0600 enrollment file and is never printed or logged.
"""
from __future__ import annotations

import argparse
from getpass import getpass
from pathlib import Path

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.models.enums import PlatformRole
from app.services.platform_bootstrap import create_platform_user, write_enrollment_secret


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("email")
    parser.add_argument(
        "--role",
        choices=[role.value for role in PlatformRole],
        default=PlatformRole.PLATFORM_OWNER.value,
    )
    parser.add_argument("--enrollment-file", required=True, type=Path)
    args = parser.parse_args()
    password = getpass("Platform password: ")
    confirmation = getpass("Confirm platform password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")

    settings = get_settings()
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        user, totp_secret = create_platform_user(
            session,
            email=args.email,
            password=password,
            role=PlatformRole(args.role),
        )
        session.commit()
        write_enrollment_secret(args.enrollment_file, totp_secret)
        print(f"platform_user_id={user.id}")
        print(f"email={user.email}")
        print(f"role={user.role.value}")
        print(f"enrollment_file={args.enrollment_file}")


if __name__ == "__main__":
    main()
