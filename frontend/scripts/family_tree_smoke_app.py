"""Serve the real backend with this wrapper's private, current web bundle."""
from pathlib import Path
import os
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from app.config import get_settings
from app.smoke_safety import require_isolated_smoke_database
from app.main import create_app

_database = require_isolated_smoke_database(get_settings().database_url)
_dist = Path(os.environ["FAMILY_TREE_SMOKE_DIST"]).resolve()
_storage = Path(os.environ["FAMILY_TREE_STORAGE_ROOT"]).resolve()
if _dist.parent != _database.parent or _storage.parent != _database.parent:
    raise RuntimeError("Bundle, media storage and database must belong to one wrapper directory.")
app = create_app(frontend_dist_dir=_dist)
