from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db import get_engine, get_session_factory


@pytest.fixture(autouse=True)
def _clear_db_caches() -> None:
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    yield
    get_engine.cache_clear()
    get_session_factory.cache_clear()
