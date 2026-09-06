"""Tests for the disposable-mailbox bridge used only by isolated Playwright reset smoke."""

from __future__ import annotations

import ast
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.db import get_engine, get_session_factory, initialize_database
from app.models import Household, PasswordResetDelivery, User
from app.models.enums import UserRole
from app.security import hash_parent_password
from app.services.password_reset_mail import render_reset_link_message
from app.services.password_resets import PasswordResetService
from scripts import issue_playwright_password_reset as reset_bridge


BACKEND_ROOT = Path(__file__).resolve().parents[1]
_BRIDGE_TEST_TOKEN = "v1.bridge-row-1234567890.proof-abcdefghijklmnopqrstuvwxyz"


@pytest.fixture(autouse=True)
def _clear_cached_settings_and_engines() -> None:
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    yield
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


def _assertion_directly_exposes_live_bridge_value(assertion: ast.Assert) -> bool:
    """Detect pytest-rewritten assertions that could render a live capability."""
    expression = assertion.test if assertion.msg is None else ast.Tuple(elts=[assertion.test, assertion.msg])
    if any(isinstance(node, ast.Name) and node.id in {"reset_token", "stdout"} for node in ast.walk(expression)):
        return True
    return any(
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id == "result"
        and node.attr in {"stdout", "stderr"}
        for node in ast.walk(expression)
    )


def test_live_capability_bridge_assertions_are_diagnostic_safe() -> None:
    tree = ast.parse(Path(__file__).read_text(encoding="utf-8"))
    unsafe_assertion_lines = [
        assertion.lineno
        for assertion in ast.walk(tree)
        if isinstance(assertion, ast.Assert) and _assertion_directly_exposes_live_bridge_value(assertion)
    ]

    assert unsafe_assertion_lines == []


@pytest.mark.parametrize("descriptor", ("0", "1", "2", "4"))
def test_isolated_playwright_bridge_refuses_non_dedicated_output_descriptors(
    monkeypatch: pytest.MonkeyPatch,
    descriptor: str,
) -> None:
    """The bridge must never turn stdin/stdout/stderr or another FD into a token sink."""
    monkeypatch.setenv("PLAYWRIGHT_PASSWORD_RESET_RESULT_FD", descriptor)
    monkeypatch.delenv("PLAYWRIGHT_ISOLATED_DB", raising=False)

    with pytest.raises(RuntimeError, match="dedicated result pipe"):
        reset_bridge.main(["--email", "reset-parent@example.com"])


def test_isolated_playwright_bridge_refuses_fd_three_when_it_is_not_ipc(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """FD 3 must be a dedicated FIFO/socket, never an arbitrary inherited file."""
    monkeypatch.setenv("PLAYWRIGHT_PASSWORD_RESET_RESULT_FD", "3")
    monkeypatch.delenv("PLAYWRIGHT_ISOLATED_DB", raising=False)
    with open(__file__, "rb") as arbitrary_file:
        original_descriptor = os.dup(3)
        try:
            os.dup2(arbitrary_file.fileno(), 3)
            with pytest.raises(RuntimeError, match="dedicated result pipe"):
                reset_bridge.main(["--email", "reset-parent@example.com"])
        finally:
            os.dup2(original_descriptor, 3)
            os.close(original_descriptor)


def test_isolated_playwright_bridge_extracts_only_the_exact_public_reset_route() -> None:
    message = render_reset_link_message(
        recipient="reset-parent@example.com",
        reset_url=f"https://family.multihost.ing/chore/reset-password#token={_BRIDGE_TEST_TOKEN}",
        expires_minutes=15,
    )

    assert reset_bridge._extract_token(message, recipient="reset-parent@example.com") == _BRIDGE_TEST_TOKEN


@pytest.mark.parametrize(
    "reset_url",
    (
        f"https://attacker.invalid/chore/reset-password#token={_BRIDGE_TEST_TOKEN}",
        f"https://family.multihost.ing/chore/reset-password/?token={_BRIDGE_TEST_TOKEN}",
        f"https://family.multihost.ing/chore/reset-password?next=1#token={_BRIDGE_TEST_TOKEN}",
    ),
)
def test_isolated_playwright_bridge_rejects_foreign_or_noncanonical_reset_routes(reset_url: str) -> None:
    message = render_reset_link_message(
        recipient="reset-parent@example.com",
        reset_url=reset_url,
        expires_minutes=15,
    )

    with pytest.raises(RuntimeError, match="exact public reset route"):
        reset_bridge._extract_token(message, recipient="reset-parent@example.com")


def test_isolated_playwright_bridge_captures_a_real_worker_message_only_in_memory(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """The smoke bridge must drive the worker without persisting the capability."""
    managed_dir = Path(tempfile.gettempdir()) / f"family-manager-playwright-reset-{uuid4().hex}"
    try:
        managed_dir.mkdir(mode=0o700)
        (managed_dir / ".family-manager-smoke").touch(mode=0o600)
        database_url = f"sqlite:///{managed_dir / 'chore_tracking.db'}"
        monkeypatch.setenv("APP_ENV", "test")
        monkeypatch.setenv("DATABASE_URL", database_url)
        monkeypatch.setenv("SECRET_KEY", "s" * 32)
        monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
        monkeypatch.setenv("PASSWORD_RESET_ENABLED", "true")
        monkeypatch.setenv("PASSWORD_RESET_PUBLIC_APP_URL", "https://family.multihost.ing/chore")
        monkeypatch.setenv("PASSWORD_RESET_FROM_ADDRESS", "no-reply@family.multihost.ing")
        monkeypatch.setenv("PASSWORD_RESET_SENDMAIL_PATH", "/bin/true")
        monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")
        get_settings.cache_clear()
        get_engine.cache_clear()
        get_session_factory.cache_clear()
        settings = get_settings()
        initialize_database(settings)

        factory = get_session_factory(settings.database_url)
        with factory() as session:
            household = Household(name="Playwright reset harness", timezone="UTC")
            session.add(household)
            session.flush()
            user = User(
                household_id=household.id,
                email="reset-parent@example.com",
                password_hash=hash_parent_password("an existing parent password"),
                role=UserRole.PARENT,
            )
            session.add(user)
            session.flush()
            assert (
                PasswordResetService(settings=settings).request_password_reset(
                    session,
                    email=user.email,
                    ip_address="127.0.0.1",
                ).value
                == "issued"
            )
            session.commit()

        script_path = BACKEND_ROOT / "scripts" / "issue_playwright_password_reset.py"
        reader, writer = os.pipe()
        try:
            environment = dict(os.environ)
            environment["PLAYWRIGHT_PASSWORD_RESET_RESULT_FD"] = "3"

            def map_result_pipe_to_fd_three() -> None:
                os.dup2(writer, 3)

            result = subprocess.run(
                [sys.executable, str(script_path), "--email", "reset-parent@example.com"],
                cwd=BACKEND_ROOT,
                env=environment,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                close_fds=False,
                preexec_fn=map_result_pipe_to_fd_three,
                check=False,
            )
        finally:
            os.close(writer)
        reset_token = os.read(reader, 2048).decode("ascii")
        os.close(reader)
        bridge_exited_successfully = result.returncode == 0
        bridge_error_lines = result.stderr.decode("utf-8", errors="replace").splitlines()
        bridge_error = bridge_error_lines[-1] if bridge_error_lines else "no error detail"
        assert bridge_exited_successfully, (
            f"The isolated reset bridge exited unsuccessfully: {bridge_error}"
        )
        bridge_stdout_was_empty = result.stdout == b""
        assert bridge_stdout_was_empty, "The isolated reset bridge emitted unexpected stdout."
        token_matches_public_capability_grammar = re.fullmatch(r"[A-Za-z0-9._~-]{1,1024}", reset_token) is not None
        assert token_matches_public_capability_grammar, "The isolated reset bridge returned an invalid reset capability."
        assert list(managed_dir.glob("controlled-mailbox*")) == []
        assert list(managed_dir.glob("*.eml")) == []

        with factory() as session:
            delivery = session.scalar(select(PasswordResetDelivery))
            assert delivery is not None
            assert delivery.status == "accepted"

        stdout = capsys.readouterr().out
        reset_token_appeared_in_stdout = reset_token in stdout
        assert not reset_token_appeared_in_stdout, "The isolated reset bridge leaked a reset capability into captured stdout."
        recipient_appeared_in_stdout = "reset-parent@example.com" in stdout
        assert not recipient_appeared_in_stdout, "The isolated reset bridge leaked a recipient into captured stdout."
    finally:
        shutil.rmtree(managed_dir, ignore_errors=True)
