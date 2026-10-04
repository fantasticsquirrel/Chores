import type { CreateRecipeRequest, RecipeDetail, RecipeIngredientRequest, RecipeStepRequest } from '@family-manager/family-api/models';

export const emptyIngredient = (position: number): RecipeIngredientRequest => ({ position, group_name: '', quantity: null, unit: '', item: '', preparation: '', note: '', is_optional: false });
export const emptyStep = (position: number): RecipeStepRequest => ({ position, section: '', instruction: '', ingredient_position_refs: [] });
export function emptyPayload(): CreateRecipeRequest {
  return { parent_recipe_id: null, title: '', description: '', photo_url: null, source_name: '', source_url: null, prep_minutes: null, cook_minutes: null, servings: null, yield_quantity: null, yield_unit: '', rating: null, favorite: false, notes: '', category_ids: [], tag_ids: [], ingredients: [emptyIngredient(1)], steps: [emptyStep(1)], components: [] };
}
export function payloadFromRecipe(r: RecipeDetail): CreateRecipeRequest {
  return {
    parent_recipe_id: r.parent_recipe_id, title: r.title, description: r.description, photo_url: r.photo_url,
    source_name: r.source_name, source_url: r.source_url, prep_minutes: r.prep_minutes, cook_minutes: r.cook_minutes,
    servings: r.servings, yield_quantity: r.yield_quantity, yield_unit: r.yield_unit, rating: r.rating, favorite: r.favorite, notes: r.notes,
    category_ids: r.categories.map(c => c.id), tag_ids: r.tags.map(t => t.id),
    ingredients: r.ingredients.map(i => ({ position: i.position, group_name: i.group_name, quantity: i.quantity, unit: i.unit, item: i.item, preparation: i.preparation, note: i.note, is_optional: i.is_optional })),
    steps: r.steps.map(s => ({ position: s.position, section: s.section, instruction: s.instruction, ingredient_position_refs: [...s.ingredient_position_refs] })),
    components: r.components.map(c => ({ component_recipe_id: c.component_recipe_id, label: c.label, quantity: c.quantity, unit: c.unit })),
  };
}
export function preparePayload(p: CreateRecipeRequest, recipeId?: number): CreateRecipeRequest {
  const kept = (p.ingredients ?? []).filter(i => i.item.trim());
  const positions = new Map(kept.map((i, n) => [i.position, n + 1]));
  return { ...p, title: p.title.trim(), ingredients: kept.map((i, n) => ({ ...i, position: n + 1 })),
    steps: (p.steps ?? []).filter(s => s.instruction.trim()).map((s, n) => ({ ...s, position: n + 1, ingredient_position_refs: [...new Set((s.ingredient_position_refs ?? []).flatMap(ref => positions.has(ref) ? [positions.get(ref)!] : []))] })),
    components: (p.components ?? []).filter(c => c.component_recipe_id > 0 && c.component_recipe_id !== recipeId),
  };
}
export function removeIngredient(p: CreateRecipeRequest, index: number): CreateRecipeRequest {
  const rows = p.ingredients ?? [];
  const removed = rows[index]?.position;
  const kept = rows.filter((_, n) => n !== index);
  const positions = new Map(kept.map((i, n) => [i.position, n + 1]));
  return { ...p, ingredients: kept.map((i, n) => ({ ...i, position: n + 1 })), steps: (p.steps ?? []).map(s => ({ ...s, ingredient_position_refs: (s.ingredient_position_refs ?? []).filter(ref => ref !== removed && positions.has(ref)).map(ref => positions.get(ref)!) })) };
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseBackup(text: string): CreateRecipeRequest[] {
  try {
    if (text.length > 5_000_000) throw new Error();
    const data: unknown = JSON.parse(text);
    if (!record(data) || data.version !== 1 || !Array.isArray(data.recipes) || data.recipes.length > 1000) throw new Error();
    return data.recipes.map((r: unknown) => {
      if (!record(r) || typeof r.title !== 'string' || !r.title.trim()) throw new Error();
      for (const key of ['ingredients', 'steps', 'components', 'categories', 'tags']) if (!Array.isArray(r[key])) throw new Error();
      for (const key of ['description', 'source_name', 'yield_unit', 'notes']) if (typeof r[key] !== 'string') throw new Error();
      for (const key of ['servings', 'yield_quantity', 'prep_minutes', 'cook_minutes', 'rating']) if (r[key] !== null && (typeof r[key] !== 'number' || !Number.isFinite(r[key]))) throw new Error();
      for (const i of r.ingredients as unknown[]) if (!record(i) || typeof i.item !== 'string' || !Number.isInteger(i.position) || (i.quantity !== null && (typeof i.quantity !== 'number' || !Number.isFinite(i.quantity)))) throw new Error();
      for (const s of r.steps as unknown[]) if (!record(s) || typeof s.instruction !== 'string' || !Array.isArray(s.ingredient_position_refs) || !s.ingredient_position_refs.every(ref => Number.isInteger(ref) && ref > 0)) throw new Error();
      const payload = payloadFromRecipe({ ...r, categories: [], tags: [], components: [] } as unknown as RecipeDetail);
      return preparePayload({ ...payload, parent_recipe_id: null });
    });
  } catch { throw new Error('Unsupported or invalid recipe backup. Paste a version 1 JSON export.'); }
}
