import type {
  CreateRecipeRequest,
  RecipeDetail,
  RecipeIngredientRequest,
  RecipeScaleResponse,
  RecipeStepRequest,
  RecipeSummary,
} from "../../../api";
import { formatQuantity } from "../../../pages/recipes/scaling";

export function emptyIngredient(position = 1): RecipeIngredientRequest {
  return {
    position,
    group_name: "",
    quantity: null,
    unit: "",
    item: "",
    preparation: "",
    note: "",
    is_optional: false,
  };
}

export function emptyStep(position = 1): RecipeStepRequest {
  return { position, section: "", instruction: "", ingredient_position_refs: [] };
}

export function buildEmptyRecipePayload(): CreateRecipeRequest {
  return {
    title: "",
    description: "",
    photo_url: null,
    source_name: "",
    source_url: null,
    prep_minutes: null,
    cook_minutes: null,
    servings: null,
    yield_quantity: null,
    yield_unit: "",
    favorite: false,
    rating: null,
    notes: "",
    category_ids: [],
    tag_ids: [],
    ingredients: [emptyIngredient()],
    steps: [emptyStep()],
    components: [],
  };
}

export function payloadFromRecipe(recipe: RecipeDetail): CreateRecipeRequest {
  return {
    parent_recipe_id: recipe.parent_recipe_id,
    title: recipe.title,
    description: recipe.description,
    photo_url: recipe.photo_url,
    source_name: recipe.source_name,
    source_url: recipe.source_url,
    prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes,
    servings: recipe.servings,
    yield_quantity: recipe.yield_quantity,
    yield_unit: recipe.yield_unit,
    rating: recipe.rating,
    favorite: recipe.favorite,
    notes: recipe.notes,
    category_ids: recipe.categories.map((row) => row.id),
    tag_ids: recipe.tags.map((row) => row.id),
    ingredients: recipe.ingredients.map((row, index) => ({
      position: index + 1,
      group_name: row.group_name,
      quantity: row.quantity,
      unit: row.unit,
      item: row.item,
      preparation: row.preparation,
      note: row.note,
      is_optional: row.is_optional,
    })),
    steps: recipe.steps.map((row, index) => ({
      position: index + 1,
      section: row.section,
      instruction: row.instruction,
      ingredient_position_refs: row.ingredient_position_refs,
    })),
    components: recipe.components.map((row) => ({
      component_recipe_id: row.component_recipe_id,
      label: row.label,
      quantity: row.quantity,
      unit: row.unit,
    })),
  };
}

export function backupRecipeToPayload(recipe: RecipeDetail): CreateRecipeRequest {
  const payload = payloadFromRecipe(recipe);
  return { ...payload, category_ids: [], tag_ids: [], components: [] };
}

export function displayIngredientQuantity(
  row: RecipeDetail["ingredients"][number] | RecipeScaleResponse["ingredients"][number],
): number | null {
  if ("scaled_quantity" in row) {
    const scaledQuantity = row.scaled_quantity;
    if (typeof scaledQuantity === "number" || scaledQuantity === null) return scaledQuantity;
  }
  return row.quantity;
}

export function displayStepInstruction(
  step: RecipeDetail["steps"][number] | RecipeScaleResponse["steps"][number],
): string {
  if ("scaled_instruction" in step && typeof step.scaled_instruction === "string") return step.scaled_instruction;
  return step.instruction;
}

export function formatScaleInput(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

export function formatIngredientLine(
  row: RecipeDetail["ingredients"][number] | RecipeScaleResponse["ingredients"][number],
): string {
  return [formatQuantity(displayIngredientQuantity(row)), row.unit, row.item, row.preparation]
    .filter((part) => part.trim().length > 0)
    .join(" ");
}

export function parsePositionRefs(value: string): number[] {
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

export function recipeMetaPills(recipe: RecipeSummary): string[] {
  return [
    recipe.servings !== null ? `Serves ${formatQuantity(recipe.servings)}` : "Servings not set",
    `${recipe.ingredient_count} ingredients`,
    recipe.rating !== null ? `${recipe.rating}/5 rating` : "Not rated",
  ];
}

export function recipeTaxonomy(recipe: RecipeSummary): string[] {
  return [...recipe.categories.map((row) => row.name), ...recipe.tags.map((row) => `#${row.name}`)];
}

export function buildRecipePayloadForSave(payload: CreateRecipeRequest): CreateRecipeRequest {
  const ingredients = (payload.ingredients ?? [])
    .filter((row) => row.item.trim().length > 0)
    .map((row, index) => ({ ...row, position: index + 1 }));
  const validPositions = new Set(ingredients.map((row) => row.position));
  const steps = (payload.steps ?? [])
    .filter((row) => row.instruction.trim().length > 0)
    .map((row, index) => ({
      ...row,
      position: index + 1,
      ingredient_position_refs: (row.ingredient_position_refs ?? []).filter((ref) => validPositions.has(ref)),
    }));
  if (steps.length > 0 && ingredients.length > 0 && (steps[0].ingredient_position_refs ?? []).length === 0) {
    steps[0] = { ...steps[0], ingredient_position_refs: [ingredients[0].position] };
  }
  const components = (payload.components ?? []).filter((row) => row.component_recipe_id > 0);
  return { ...payload, title: payload.title.trim(), ingredients, steps, components };
}
