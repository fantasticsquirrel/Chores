from __future__ import annotations

import os
from pathlib import Path

import pytest

from app import smoke_safety
from app.config import get_settings
from app.smoke_safety import require_isolated_smoke_database


def test_smoke_seed_rejects_production_database_even_with_opt_in(monkeypatch) -> None:
    repo_root = Path(__file__).resolve().parents[2]
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")

    with pytest.raises(RuntimeError, match="production database"):
        require_isolated_smoke_database(f"sqlite:///{repo_root / 'data' / 'chore_tracking.db'}")


def test_smoke_seed_rejects_relative_production_database_url(monkeypatch) -> None:
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")

    with pytest.raises(RuntimeError, match="production database"):
        require_isolated_smoke_database("sqlite:///data/chore_tracking.db")


def test_smoke_seed_rejects_existing_arbitrary_database(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")
    database = tmp_path / "unrelated.db"
    database.touch()

    with pytest.raises(RuntimeError, match="managed temporary directory"):
        require_isolated_smoke_database(f"sqlite:///{database}")


def test_smoke_seed_requires_explicit_isolated_database_opt_in(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("PLAYWRIGHT_ISOLATED_DB", raising=False)

    with pytest.raises(RuntimeError, match="PLAYWRIGHT_ISOLATED_DB"):
        require_isolated_smoke_database(f"sqlite:///{tmp_path / 'smoke.db'}")


def test_smoke_seed_accepts_explicit_temporary_database(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")
    smoke_dir = tmp_path / "family-manager-playwright-test"
    smoke_dir.mkdir(mode=0o700)
    smoke_dir.chmod(0o700)
    marker = smoke_dir / ".family-manager-smoke"
    marker.touch(mode=0o600)
    marker.chmod(0o600)

    path = require_isolated_smoke_database(f"sqlite:///{smoke_dir / 'smoke.db'}")

    assert path == (smoke_dir / "smoke.db").resolve()


def test_smoke_seed_rejects_an_insecure_or_symlinked_marker(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")
    smoke_dir = tmp_path / "family-manager-playwright-private-marker"
    smoke_dir.mkdir(mode=0o700)
    smoke_dir.chmod(0o700)
    marker = smoke_dir / ".family-manager-smoke"
    marker.touch(mode=0o644)
    marker.chmod(0o644)

    with pytest.raises(RuntimeError, match="managed temporary directory"):
        require_isolated_smoke_database(f"sqlite:///{smoke_dir / 'smoke.db'}")

    marker.unlink()
    outside_marker = tmp_path / "outside-marker"
    outside_marker.touch(mode=0o600)
    outside_marker.chmod(0o600)
    marker.symlink_to(outside_marker)
    with pytest.raises(RuntimeError, match="managed temporary directory"):
        require_isolated_smoke_database(f"sqlite:///{smoke_dir / 'smoke.db'}")


def _private_smoke_directory(tmp_path: Path, name: str) -> Path:
    smoke_dir = tmp_path / name
    smoke_dir.mkdir(mode=0o700)
    smoke_dir.chmod(0o700)
    marker = smoke_dir / ".family-manager-smoke"
    marker.touch(mode=0o600)
    marker.chmod(0o600)
    return smoke_dir


def test_smoke_seed_rejects_a_production_database_hard_link_in_a_managed_directory(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")
    smoke_dir = _private_smoke_directory(tmp_path, "family-manager-playwright-hard-link")
    production_database = tmp_path / "production.db"
    production_database.touch(mode=0o600)
    production_database.chmod(0o600)
    smoke_database = smoke_dir / "smoke.db"
    os.link(production_database, smoke_database)
    monkeypatch.setattr(smoke_safety, "PRODUCTION_DATABASE", production_database.resolve())

    with pytest.raises(RuntimeError, match="production database"):
        require_isolated_smoke_database(f"sqlite:///{smoke_database}")


def test_smoke_seed_rejects_a_hard_linked_marker(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")
    smoke_dir = _private_smoke_directory(tmp_path, "family-manager-playwright-hard-linked-marker")
    (smoke_dir / ".family-manager-smoke").unlink()
    trusted_marker = tmp_path / "trusted-marker"
    trusted_marker.touch(mode=0o600)
    trusted_marker.chmod(0o600)
    os.link(trusted_marker, smoke_dir / ".family-manager-smoke")

    with pytest.raises(RuntimeError, match="managed temporary directory"):
        require_isolated_smoke_database(f"sqlite:///{smoke_dir / 'smoke.db'}")


@pytest.mark.parametrize("unsafe_suffix", ("?mode=ro", "#fragment", "%3Fmode%3Dro"))
def test_smoke_seed_rejects_sqlite_uri_options_and_encoded_path_forms(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    unsafe_suffix: str,
) -> None:
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")
    smoke_dir = _private_smoke_directory(tmp_path, "family-manager-playwright-url-safety")

    with pytest.raises(RuntimeError, match="canonical SQLite filename URL"):
        require_isolated_smoke_database(f"sqlite:///{smoke_dir / 'smoke.db'}{unsafe_suffix}")


def test_isolated_smoke_settings_canonicalize_the_validated_database_path(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    smoke_dir = _private_smoke_directory(tmp_path, "family-manager-playwright-canonical-url")
    monkeypatch.setenv("PLAYWRIGHT_ISOLATED_DB", "1")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{smoke_dir}/nested/../smoke.db")
    get_settings.cache_clear()
    try:
        settings = get_settings()
    finally:
        get_settings.cache_clear()

    assert settings.database_url == f"sqlite:///{(smoke_dir / 'smoke.db').resolve()}"
