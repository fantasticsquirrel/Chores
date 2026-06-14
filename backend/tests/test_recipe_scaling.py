from __future__ import annotations

from app.services.recipes import scale_ingredients, scale_linked_steps


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


def test_scale_ingredients_can_use_multiplier_without_target_servings() -> None:
    result = scale_ingredients(
        [{"id": 1, "quantity": 2.0, "unit": "cup", "item": "flour"}],
        base_servings=4,
        scale_factor=1.5,
    )

    assert result["factor"] == 1.5
    assert result["target_servings"] == 6.0
    assert result["ingredients"][0]["scaled_quantity"] == 3.0


def test_scale_ingredients_can_use_multiplier_even_without_base_servings() -> None:
    result = scale_ingredients(
        [{"id": 1, "quantity": 2.0, "unit": "cup", "item": "flour"}],
        base_servings=None,
        scale_factor=3,
    )

    assert result["factor"] == 3.0
    assert result["target_servings"] is None
    assert result["warnings"] == ["Default servings are not set; multiplier scaling was applied without a target serving count."]
    assert result["ingredients"][0]["scaled_quantity"] == 6.0


def test_scale_ingredients_uses_factor_one_when_base_servings_missing() -> None:
    result = scale_ingredients(
        [{"id": 1, "quantity": 3.0, "unit": "tbsp", "item": "oil"}],
        base_servings=None,
        target_servings=6,
    )

    assert result["factor"] == 1.0
    assert result["warnings"] == ["Default servings are not set; quantities were not scaled."]
    assert result["ingredients"][0]["scaled_quantity"] == 3.0


def test_scale_linked_steps_attaches_scaled_ingredient_usage() -> None:
    scaled_ingredients = [
        {"id": 10, "quantity": 2.0, "scaled_quantity": 4.0, "unit": "cup", "item": "flour"},
        {"id": 11, "quantity": 1.0, "scaled_quantity": 2.0, "unit": "cup", "item": "milk"},
    ]
    steps = [{"id": 20, "instruction": "Whisk flour and milk until smooth."}]

    result = scale_linked_steps(
        steps,
        scaled_ingredients=scaled_ingredients,
        step_ingredient_ids={20: [10, 11]},
    )

    assert result == [
        {
            "id": 20,
            "instruction": "Whisk flour and milk until smooth.",
            "scaled_instruction": "Whisk flour and milk until smooth. Uses: 4 cup flour; 2 cup milk.",
            "linked_ingredients": [
                {"id": 10, "quantity": 2.0, "scaled_quantity": 4.0, "unit": "cup", "item": "flour"},
                {"id": 11, "quantity": 1.0, "scaled_quantity": 2.0, "unit": "cup", "item": "milk"},
            ],
        }
    ]
