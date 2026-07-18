#!/usr/bin/env python3
"""Bootstrap a platform owner or support operator without provider credentials.

The password is read with getpass so it is not exposed in process arguments or
shell history. The TOTP secret is emitted once; redirect stdout to a mode-0600
credential file or enroll it immediately in an authenticator.
"""
from __future__ import annotations

import argparse
from getpass import getpass

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.models.enums import PlatformRole
from app.services.platform_bootstrap import create_platform_user


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("email")
    parser.add_argument(
        "--role",
        choices=[role.value for role in PlatformRole],
        default=PlatformRole.OWNER.value,
    )
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
        print(f"platform_user_id={user.id}")
        print(f"email={user.email}")
        print(f"role={user.role.value}")
        print(f"totp_secret={totp_secret}")


if __name__ == "__main__":
    main()
