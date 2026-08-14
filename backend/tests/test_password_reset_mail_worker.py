from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email import policy
from email.parser import BytesParser
from pathlib import Path
from threading import Event, Thread

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.db import get_engine, get_session_factory, initialize_database
from app.models.core import Household, PasswordReset, PasswordResetDelivery, PasswordResetRequest, User
from app.models.enums import UserRole
from app.security import hash_password
from app.security.password_resets import digest_password_reset_token, format_password_reset_token
from app.services.password_reset_mail import (
    MailSubmissionError,
    PasswordResetMailWorker,
)
from app.services.password_resets import PasswordResetService


@dataclass(frozen=True)
class _MailSettings:
    password_reset_enabled: bool = True
    password_reset_public_app_url: str = "https://family.multihost.ing/chore"
    password_reset_token_keys: tuple[tuple[str, str], ...] = (("v1", "t" * 32),)
    password_reset_sendmail_path: str = "/usr/sbin/sendmail"
    password_reset_sendmail_timeout_seconds: int = 5
    password_reset_worker_batch_size: int = 10
    password_reset_delivery_lease_seconds: int = 120
    password_reset_delivery_max_attempts: int = 3
    password_reset_retention_days: int = 30


@pytest.fixture(autouse=True)
def _clear_cached_engines() -> None:
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    yield
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


def _configure_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'password-reset-mail.db'}")
    monkeypatch.setenv("SECRET_KEY", "s" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    initialize_database(get_settings())


def _seed_delivery(
    *,
    now: datetime,
    kind: str = "reset_link",
    reset_kwargs: dict[str, object] | None = None,
    suffix: str = "one",
) -> tuple[PasswordReset, PasswordResetDelivery, str]:
    factory = get_session_factory(get_settings().database_url)
    settings = _MailSettings()
    with factory() as session:
        household = Household(name="Mail Home", timezone="UTC")
        session.add(household)
        session.flush()
        user = User(
            household_id=household.id,
            email=f"parent-{suffix}@example.com",
            password_hash=hash_password("existing-password-123"),
            role=UserRole.PARENT,
        )
        session.add(user)
        session.flush()
        reset_id = f"mail-reset-row-{suffix}"
        token = format_password_reset_token(reset_id, key_version="v1", token_keys=settings.password_reset_token_keys)
        reset_values: dict[str, object] = {
            "id": reset_id,
            "user_id": user.id,
            "token_key_version": "v1",
            "token_digest": digest_password_reset_token(token, key_version="v1", token_keys=settings.password_reset_token_keys),
            "expires_at": now + timedelta(minutes=15),
            "created_at": now,
        }
        reset_values.update(reset_kwargs or {})
        reset = PasswordReset(**reset_values)
        delivery = PasswordResetDelivery(
            password_reset_id=reset.id,
            kind=kind,
            status="pending",
            available_at=now,
            created_at=now,
        )
        session.add_all((reset, delivery))
        session.commit()
        session.refresh(reset)
        session.refresh(delivery)
        return reset, delivery, token


def _delivery(delivery_id: int) -> PasswordResetDelivery:
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        row = session.get(PasswordResetDelivery, delivery_id)
        assert row is not None
        return row


def _count_rows(model: type[object]) -> int:
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        return len(session.scalars(select(model)).all())


def test_worker_derives_fragment_token_only_in_memory_and_marks_local_mta_acceptance(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_database(tmp_path, monkeypatch)
    now = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
    reset, delivery, raw_token = _seed_delivery(now=now)
    submitted: list[bytes] = []

    worker = PasswordResetMailWorker(settings=_MailSettings(), submit=lambda raw: submitted.append(raw))
    assert worker.process_pending(now=now) == {"accepted": 1}

    persisted = _delivery(delivery.id)
    assert persisted.status == "accepted"
    assert persisted.accepted_by_mta_at is not None
    assert persisted.terminal_at is not None
    assert persisted.last_error_code == ""
    assert len(submitted) == 1
    parsed = BytesParser(policy=policy.default).parsebytes(submitted[0])
    plain = parsed.get_body(preferencelist=("plain",))
    assert plain is not None
    assert f"/reset-password#token={raw_token}" in plain.get_content()
    assert raw_token not in reset.token_digest
    assert raw_token not in persisted.last_error_code
    assert raw_token not in str(persisted.__dict__)


def test_worker_cancels_expired_or_consumed_reset_links_before_submitting(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_database(tmp_path, monkeypatch)
    now = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
    _expired_reset, expired_delivery, _ = _seed_delivery(
        now=now - timedelta(minutes=16),
        reset_kwargs={"expires_at": now - timedelta(seconds=1)},
        suffix="expired",
    )
    _consumed_reset, consumed_delivery, _ = _seed_delivery(
        now=now,
        reset_kwargs={"consumed_at": now},
        suffix="consumed",
    )
    submitted: list[bytes] = []

    worker = PasswordResetMailWorker(settings=_MailSettings(), submit=lambda raw: submitted.append(raw))
    assert worker.process_pending(now=now) == {"cancelled": 2}
    assert submitted == []
    assert _delivery(expired_delivery.id).status == "cancelled"
    assert _delivery(consumed_delivery.id).status == "cancelled"


def test_worker_cancels_a_claim_when_its_issued_token_key_was_retired(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """A missing historical HMAC key must not strand a claimed outbox row."""
    _configure_database(tmp_path, monkeypatch)
    now = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
    reset, delivery, _ = _seed_delivery(now=now)
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        row = session.get(PasswordReset, reset.id)
        assert row is not None
        row.token_key_version = "retired-key"
        session.commit()

    submitted: list[bytes] = []
    worker = PasswordResetMailWorker(settings=_MailSettings(), submit=submitted.append)

    assert worker.process_pending(now=now) == {"cancelled": 1}
    cancelled = _delivery(delivery.id)
    assert cancelled.status == "cancelled"
    assert cancelled.last_error_code == "token-key-unavailable"
    assert cancelled.attempt_count == 0
    assert submitted == []
    assert worker.process_pending(now=now) == {}


def test_worker_retries_only_safe_error_code_and_stops_at_bounded_attempts(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_database(tmp_path, monkeypatch)
    now = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
    _reset, delivery, token = _seed_delivery(now=now)

    def failing_submit(_: bytes) -> None:
        raise MailSubmissionError("mta-timeout")

    settings = _MailSettings(password_reset_delivery_max_attempts=2)
    worker = PasswordResetMailWorker(settings=settings, submit=failing_submit)
    assert worker.process_pending(now=now) == {"retry": 1}
    retry = _delivery(delivery.id)
    assert retry.status == "retry"
    assert retry.attempt_count == 1
    assert retry.last_error_code == "mta-timeout"
    assert token not in retry.last_error_code
    assert worker.process_pending(now=retry.available_at.replace(tzinfo=UTC)) == {"dead": 1}
    dead = _delivery(delivery.id)
    assert dead.status == "dead"
    assert dead.attempt_count == 2
    assert dead.last_error_code == "mta-timeout"


def test_worker_reclaims_stale_lease_once_and_does_not_duplicate_accepted_delivery(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_database(tmp_path, monkeypatch)
    now = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
    _reset, delivery, _ = _seed_delivery(now=now)
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        row = session.get(PasswordResetDelivery, delivery.id)
        assert row is not None
        row.status = "processing"
        row.lease_expires_at = now - timedelta(seconds=1)
        session.commit()

    submitted: list[bytes] = []
    worker = PasswordResetMailWorker(settings=_MailSettings(), submit=lambda raw: submitted.append(raw))
    assert worker.process_pending(now=now) == {"accepted": 1}
    assert worker.process_pending(now=now) == {}
    assert len(submitted) == 1


def test_worker_serializes_reset_invalidation_behind_the_local_mta_handoff(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """A reset invalidation cannot win after final validation but before MTA acceptance."""
    _configure_database(tmp_path, monkeypatch)
    now = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
    reset, delivery, _ = _seed_delivery(now=now)
    factory = get_session_factory(get_settings().database_url)
    submission_started = Event()
    release_submission = Event()
    invalidation_started = Event()
    invalidation_done = Event()
    worker_outcomes: list[dict[str, int]] = []
    worker_errors: list[BaseException] = []
    invalidation_errors: list[BaseException] = []

    def blocking_submit(_: bytes) -> None:
        submission_started.set()
        assert release_submission.wait(timeout=5)

    def run_worker() -> None:
        try:
            worker_outcomes.append(
                PasswordResetMailWorker(settings=_MailSettings(), submit=blocking_submit).process_pending(now=now)
            )
        except BaseException as exc:  # pragma: no cover - surfaced below
            worker_errors.append(exc)

    def invalidate() -> None:
        invalidation_started.set()
        try:
            with factory() as session:
                PasswordResetService(settings=_MailSettings()).invalidate_active_resets(
                    session,
                    user_id=reset.user_id,
                    now=now,
                )
                session.commit()
        except BaseException as exc:  # pragma: no cover - surfaced below
            invalidation_errors.append(exc)
        finally:
            invalidation_done.set()

    worker_thread = Thread(target=run_worker, daemon=True)
    worker_thread.start()
    assert submission_started.wait(timeout=5)
    invalidation_thread = Thread(target=invalidate, daemon=True)
    invalidation_thread.start()
    try:
        assert invalidation_started.wait(timeout=5)
        assert not invalidation_done.wait(timeout=0.25)
    finally:
        release_submission.set()
        worker_thread.join(timeout=10)
        invalidation_thread.join(timeout=10)

    assert not worker_thread.is_alive()
    assert not invalidation_thread.is_alive()
    assert worker_errors == []
    assert invalidation_errors == []
    assert worker_outcomes == [{"accepted": 1}]
    assert _delivery(delivery.id).status == "accepted"


def test_cleanup_prunes_accepted_and_expired_reset_metadata_after_retention(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_database(tmp_path, monkeypatch)
    delivered_at = datetime(2026, 8, 1, 12, 0, tzinfo=UTC)
    reset, delivery, _ = _seed_delivery(
        now=delivered_at,
        reset_kwargs={"expires_at": delivered_at + timedelta(minutes=15)},
        suffix="retained",
    )
    worker = PasswordResetMailWorker(settings=_MailSettings(password_reset_retention_days=1), submit=lambda _: None)
    assert worker.process_pending(now=delivered_at) == {"accepted": 1}

    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        session.add(
            PasswordResetRequest(
                email_key_hash="a" * 64,
                ip_key_hash="b" * 64,
                outcome="ineligible",
                created_at=delivered_at,
            )
        )
        session.commit()

    cleanup_at = delivered_at + timedelta(days=2)
    assert worker.cleanup(now=cleanup_at) == {"pruned": 2}
    with factory() as session:
        assert session.get(PasswordResetDelivery, delivery.id) is None
        assert session.get(PasswordReset, reset.id) is None
    assert _count_rows(PasswordResetRequest) == 0


def test_password_changed_delivery_requires_consumption_and_has_no_link(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_database(tmp_path, monkeypatch)
    now = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
    _reset, pending_notice, _ = _seed_delivery(now=now, kind="password_changed")
    submitted: list[bytes] = []
    worker = PasswordResetMailWorker(settings=_MailSettings(), submit=lambda raw: submitted.append(raw))
    assert worker.process_pending(now=now) == {"cancelled": 1}
    assert _delivery(pending_notice.id).status == "cancelled"

    _consumed, consumed_notice, _ = _seed_delivery(
        now=now,
        kind="password_changed",
        reset_kwargs={"consumed_at": now},
        suffix="consumed-notice",
    )
    assert worker.process_pending(now=now) == {"accepted": 1}
    message = submitted[0].decode("utf-8")
    assert "password changed" in message.casefold()
    assert "reset-password" not in message
    assert _delivery(consumed_notice.id).status == "accepted"
