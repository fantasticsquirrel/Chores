from __future__ import annotations

from typing import Any


def scale_ingredients(
    ingredients: list[dict[str, Any]],
    *,
    base_servings: float | int | None,
    target_servings: float | int,
) -> dict[str, Any]:
    warnings: list[str] = []
    if base_servings is None or float(base_servings) <= 0:
        factor = 1.0
        warnings.append("Base servings are not set; quantities were not scaled.")
    else:
        factor = float(target_servings) / float(base_servings)

    scaled: list[dict[str, Any]] = []
    for ingredient in ingredients:
        quantity = ingredient.get("quantity")
        scaled_quantity = None if quantity is None else round(float(quantity) * factor, 6)
        scaled.append({**ingredient, "scaled_quantity": scaled_quantity})

    return {"factor": round(factor, 6), "warnings": warnings, "ingredients": scaled}
