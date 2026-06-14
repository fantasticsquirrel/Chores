from __future__ import annotations

from typing import Any


def scale_ingredients(
    ingredients: list[dict[str, Any]],
    *,
    base_servings: float | int | None,
    target_servings: float | int | None = None,
    scale_factor: float | int | None = None,
) -> dict[str, Any]:
    warnings: list[str] = []
    normalized_base = None if base_servings is None else float(base_servings)

    if scale_factor is not None:
        factor = float(scale_factor)
        resolved_target_servings = None if normalized_base is None or normalized_base <= 0 else round(normalized_base * factor, 6)
        if resolved_target_servings is None:
            warnings.append("Default servings are not set; multiplier scaling was applied without a target serving count.")
    elif target_servings is not None and normalized_base is not None and normalized_base > 0:
        resolved_target_servings = float(target_servings)
        factor = resolved_target_servings / normalized_base
    else:
        factor = 1.0
        resolved_target_servings = float(target_servings) if target_servings is not None else normalized_base
        warnings.append("Default servings are not set; quantities were not scaled.")

    scaled: list[dict[str, Any]] = []
    for ingredient in ingredients:
        quantity = ingredient.get("quantity")
        scaled_quantity = None if quantity is None else round(float(quantity) * factor, 6)
        scaled.append({**ingredient, "scaled_quantity": scaled_quantity})

    return {"factor": round(factor, 6), "target_servings": resolved_target_servings, "warnings": warnings, "ingredients": scaled}


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
