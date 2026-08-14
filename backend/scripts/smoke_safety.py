"""Backward-compatible import seam for disposable Playwright fixture scripts."""

from app.smoke_safety import require_isolated_smoke_database

__all__ = ["require_isolated_smoke_database"]
