import type { AuthSessionResponse, FamilyModule, RecipeDetail, RecipeScaleResponse } from '@family-manager/family-api/models';

export const session: AuthSessionResponse = { csrf_token: 'test-only', user: { id: 2, household_id: 7, email: 'parent@example.test', role: 'PARENT', is_household_owner: true, child_id: null } };
export const modules: FamilyModule[] = [{ key: 'recipes', name: 'Recipes', description: 'Cookbook', can_manage: true }, {key:'chores',name:'Chores',description:'Child profiles',can_manage:true}];
export const recipe: RecipeDetail = {
  id: 11, household_id: 7, owner_user_id: 2, parent_recipe_id: null,
  title: 'Soup', description: 'Family soup', photo_url: 'https://example.test/soup.jpg', source_name: 'Test Kitchen', source_url: 'https://example.test/soup',
  servings: 4, yield_quantity: 2, yield_unit: 'liters', prep_minutes: 10, cook_minutes: 20, rating: 4, favorite: true, notes: 'Keep warm', archived_at: null,
  categories: [{ id: 3, household_id: 7, owner_user_id: 2, name: 'Dinner', color: '#abc' }], tags: [{ id: 5, household_id: 7, owner_user_id: 2, name: 'Easy' }], ingredient_count: 2,
  feedback_summary: { average_rating: 4, rating_count: 1 }, feedback: [{ id: 9, recipe_id: 11, household_id: 7, reviewer_type: 'PARENT', parent_user_id: 2, child_id: null, reviewer_name: 'Parent', rating: 4, verdict: 'Loved it', notes: 'Again', created_at: '2026-01-01' }],
  ingredients: [{ id: 21, recipe_id: 11, position: 1, group_name: 'Broth', quantity: 2, unit: 'cup', item: 'water', preparation: 'hot', note: 'filtered', is_optional: false }, { id: 22, recipe_id: 11, position: 2, group_name: 'Toppings', quantity: null, unit: '', item: 'herbs', preparation: 'chopped', note: 'fresh', is_optional: true }],
  steps: [{ id: 31, recipe_id: 11, position: 1, section: 'Simmer', instruction: 'Boil water', ingredient_position_refs: [], ingredient_ids: [21] }, { id: 32, recipe_id: 11, position: 2, section: 'Finish', instruction: 'Add herbs', ingredient_position_refs: [], ingredient_ids: [22] }],
  variants: [], core_recipe: null, components: [],
};
export const scaled: RecipeScaleResponse = { recipe_id: 11, base_servings: 4, target_servings: 8, factor: 2, warnings: [], ingredients: recipe.ingredients.map(i => ({ ...i, scaled_quantity: i.quantity === null ? null : i.quantity * 2 })), steps: recipe.steps.map(s => ({ ...s, scaled_instruction: s.instruction + ' scaled', linked_ingredients: recipe.ingredients.filter(i => s.ingredient_ids.includes(i.id)).map(i => ({ ...i, scaled_quantity: i.quantity === null ? null : i.quantity * 2 })) })) };
