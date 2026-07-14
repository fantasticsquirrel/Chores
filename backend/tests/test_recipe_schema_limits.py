from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.recipes import CreateRecipeRequest, ImportRecipeBackupRequest


def test_recipe_payload_limits_nested_collection_sizes() -> None:
    ingredient = {"position": 1, "quantity": 1, "item": "flour"}
    with pytest.raises(ValidationError):
        CreateRecipeRequest(title="Too large", ingredients=[{**ingredient, "position": index + 1} for index in range(251)])


def test_recipe_backup_limits_recipe_count() -> None:
    with pytest.raises(ValidationError):
        ImportRecipeBackupRequest(recipes=[{"title": f"Recipe {index}"} for index in range(201)])
