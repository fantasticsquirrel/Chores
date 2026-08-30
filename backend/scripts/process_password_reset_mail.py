"""Run the bounded, secret-free password-reset mail outbox worker."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence

from app.config import get_settings
from app.services.password_reset_mail import PasswordResetMailWorker
from app.services.registration_mail import RegistrationMailWorker
from app.startup import run_startup_checks


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Submit a bounded batch of Family Manager password-reset mail to local sendmail."
    )
    parser.add_argument("--batch-size", type=int, default=None, help="Maximum delivery rows to claim in this run.")
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Cancel expired reset-link rows and prune expired reset-specific metadata.",
    )
    parser.add_argument(
        "--log-counts-only",
        action="store_true",
        help="Emit aggregate safe status counts as JSON; never emit recipients, URLs, or tokens.",
    )
    args = parser.parse_args(argv)
    if args.batch_size is not None and args.batch_size <= 0:
        parser.error("--batch-size must be a positive integer")
    return args


def _run_worker(args: argparse.Namespace) -> dict[str, int]:
    settings = get_settings()
    # The timer is a separate entry point from the ASGI app, so it must enforce
    # the identical reset URL/sender/key/local-MTA fail-closed preflight.
    run_startup_checks(settings)
    worker = PasswordResetMailWorker(settings=settings)
    counts = worker.process_pending(limit=args.batch_size)
    registration_worker = RegistrationMailWorker(settings=settings)
    for name, count in registration_worker.process_pending(limit=args.batch_size).items():
        counts[name] = counts.get(name, 0) + count
    if args.cleanup:
        for name, count in worker.cleanup().items():
            counts[name] = counts.get(name, 0) + count
        for name, count in registration_worker.cleanup().items():
            counts[name] = counts.get(name, 0) + count
    return counts


def run(argv: Sequence[str] | None = None) -> dict[str, int]:
    return _run_worker(parse_args(argv))


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    counts = _run_worker(args)
    # Systemd receives aggregate status only; do not serialize any outbox row.
    if args.log_counts_only:
        print(json.dumps(counts, sort_keys=True))


if __name__ == "__main__":
    main()
