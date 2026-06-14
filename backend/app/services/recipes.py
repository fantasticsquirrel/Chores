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


def _format_quantity(quantity: object) -> str:
    if quantity is None:
        return ""
    if not isinstance(quantity, int | float | str):
        return ""
    numeric = float(quantity)
    if numeric.is_integer():
        return str(int(numeric))
    return f"{numeric:g}"


def _format_ingredient_usage(ingredient: dict[str, Any]) -> str:
    quantity = _format_quantity(ingredient.get("scaled_quantity"))
    unit = str(ingredient.get("unit") or "").strip()
    item = str(ingredient.get("item") or "").strip()
    return " ".join(part for part in (quantity, unit, item) if part)


def scale_linked_steps(
    steps: list[dict[str, Any]],
    *,
    scaled_ingredients: list[dict[str, Any]],
    step_ingredient_ids: dict[int, list[int]],
) -> list[dict[str, Any]]:
    ingredient_by_id = {ingredient["id"]: ingredient for ingredient in scaled_ingredients}
    scaled_steps: list[dict[str, Any]] = []

    for step in steps:
        step_id = step["id"]
        linked = [ingredient_by_id[ingredient_id] for ingredient_id in step_ingredient_ids.get(step_id, []) if ingredient_id in ingredient_by_id]
        usage = "; ".join(_format_ingredient_usage(ingredient) for ingredient in linked)
        scaled_instruction = step["instruction"]
        if usage:
            scaled_instruction = f"{scaled_instruction} Uses: {usage}."
        scaled_steps.append({**step, "scaled_instruction": scaled_instruction, "linked_ingredients": linked})

    return scaled_steps
