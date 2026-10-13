"""Retain legacy homeschool storage and normalize historical SQLite constraints.

Revision ID: 20261014_0029
Revises: 20261013_0028
"""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys

from alembic import context, op

revision = "20261014_0029"
down_revision = "20261013_0028"
branch_labels = None
depends_on = None


def _frozen_helpers():
    name = "family_manager_frozen_compatibility_0029"
    if name not in sys.modules:
        location = Path(__file__).resolve().parents[1] / "compatibility_0029" / "__init__.py"
        spec = spec_from_file_location(name, location, submodule_search_locations=[str(location.parent)])
        module = module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
    return sys.modules[name]


def upgrade():
    if context.is_offline_mode() or op.get_bind().dialect.name != "sqlite":
        raise RuntimeError("0029 requires online SQLite preflight and reconstruction")
    _frozen_helpers().upgrade_sqlite(op.get_bind())


def downgrade():
    # Historical storage and hardened constraints cannot safely be discarded.
    raise RuntimeError("0029 is a forward-only retained-storage compatibility repair")
