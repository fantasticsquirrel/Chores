from __future__ import annotations

from app.services.recipes import scale_ingredients


def test_scale_ingredients_doubles_numeric_quantities() -> None:
    result = scale_ingredients(
        [
            {"id": 1, "quantity": 2.0, "unit": "cup", "item": "flour"},
            {"id": 2, "quantity": None, "unit": "", "item": "salt to taste"},
        ],
        base_servings=4,
        target_servings=8,
    )

    assert result["factor"] == 2.0
    assert result["warnings"] == []
    assert result["ingredients"][0]["scaled_quantity"] == 4.0
    assert result["ingredients"][1]["scaled_quantity"] is None


def test_scale_ingredients_uses_factor_one_when_base_servings_missing() -> None:
    result = scale_ingredients(
        [{"id": 1, "quantity": 3.0, "unit": "tbsp", "item": "oil"}],
        base_servings=None,
        target_servings=6,
    )

    assert result["factor"] == 1.0
    assert result["warnings"] == ["Base servings are not set; quantities were not scaled."]
    assert result["ingredients"][0]["scaled_quantity"] == 3.0
