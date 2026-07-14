from __future__ import annotations

from pathlib import Path

import pytest

from scripts.smoke_safety import require_isolated_smoke_database


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
    smoke_dir.mkdir()
    (smoke_dir / ".family-manager-smoke").touch()

    path = require_isolated_smoke_database(f"sqlite:///{smoke_dir / 'smoke.db'}")

    assert path == (smoke_dir / "smoke.db").resolve()
