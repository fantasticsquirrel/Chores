from __future__ import annotations

import pytest

from app.config import SettingsError
from scripts import process_password_reset_mail


class _Worker:
    def __init__(self, *, settings: object) -> None:
        self.settings = settings
        self.process_calls: list[int | None] = []
        self.cleanup_calls = 0

    def process_pending(self, *, limit: int | None = None) -> dict[str, int]:
        self.process_calls.append(limit)
        return {"accepted": 1}

    def cleanup(self) -> dict[str, int]:
        self.cleanup_calls += 1
        return {"pruned": 2}


def test_worker_process_runs_the_same_startup_validation_before_constructing_mail_worker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = object()
    calls: list[object] = []
    workers: list[_Worker] = []

    monkeypatch.setattr(process_password_reset_mail, "get_settings", lambda: settings)
    monkeypatch.setattr(process_password_reset_mail, "run_startup_checks", calls.append)

    def create_worker(*, settings: object) -> _Worker:
        worker = _Worker(settings=settings)
        workers.append(worker)
        return worker

    monkeypatch.setattr(process_password_reset_mail, "PasswordResetMailWorker", create_worker)

    assert process_password_reset_mail.run(["--batch-size", "7", "--cleanup"]) == {"accepted": 1, "pruned": 2}
    assert calls == [settings]
    assert len(workers) == 1
    assert workers[0].settings is settings
    assert workers[0].process_calls == [7]
    assert workers[0].cleanup_calls == 1


def test_worker_process_fails_closed_when_startup_validation_rejects_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(process_password_reset_mail, "get_settings", lambda: object())
    monkeypatch.setattr(
        process_password_reset_mail,
        "run_startup_checks",
        lambda _settings: (_ for _ in ()).throw(SettingsError("unsafe reset configuration")),
    )
    monkeypatch.setattr(
        process_password_reset_mail,
        "PasswordResetMailWorker",
        lambda **_kwargs: (_ for _ in ()).throw(AssertionError("worker must not be constructed")),
    )

    with pytest.raises(SettingsError, match="unsafe reset configuration"):
        process_password_reset_mail.run([])
