import { act, renderHook, waitFor } from "@testing-library/react";
import { apiClient, type RecipeDetail, type RecipeScaleResponse } from "../../../api";
import { useRecipeDetail } from "./useRecipeDetail";
const recipe: RecipeDetail = {
  id: 10,
  household_id: 7,
  owner_user_id: 2,
  creator_email: "parent@example.com",
  parent_recipe_id: null,
  title: "Pancakes",
  description: "Weekend breakfast",
  photo_url: null,
  source_name: "Family card",
  source_url: null,
  prep_minutes: 10,
  cook_minutes: 15,
  servings: 4,
  yield_quantity: null,
  yield_unit: "",
  rating: 5,
  favorite: true,
  notes: "Rest batter.",
  archived_at: null,
  categories: [],
  tags: [],
  ingredient_count: 1,
  feedback_summary: { average_rating: null, rating_count: 0 },
  ingredients: [
    {
      id: 100,
      recipe_id: 10,
      position: 1,
      group_name: "Batter",
      quantity: 2,
      unit: "cup",
      item: "flour",
      preparation: "",
      note: "",
      is_optional: false,
    },
  ],
  steps: [
    {
      id: 200,
      recipe_id: 10,
      position: 1,
      section: "Cook",
      instruction: "Cook on a hot griddle.",
      ingredient_position_refs: [1],
      ingredient_ids: [100],
    },
  ],
  components: [],
  variants: [],
  core_recipe: null,
  feedback: [],
};

afterEach(() => { vi.restoreAllMocks(); });
it("does not leave a newly opened recipe blocked by the previous recipe’s scale request", async () => {
  vi.spyOn(apiClient, "getRecipe").mockImplementation(async (id) => ({ ...recipe, id, title: `Recipe ${id}` }));
  vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({ user: { id: 2, household_id: 7, email: "parent@example.com", role: "PARENT", is_household_owner: false, child_id: null }, csrf_token: null });
  vi.spyOn(apiClient, "listChildren").mockResolvedValue([]);
  vi.spyOn(apiClient, "listRecipes").mockResolvedValue([]);
  vi.spyOn(apiClient, "listRecipeCategories").mockResolvedValue([]);
  vi.spyOn(apiClient, "listRecipeTags").mockResolvedValue([]);
  let resolve!: (value: RecipeScaleResponse) => void;
  vi.spyOn(apiClient, "scaleRecipe").mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { result, rerender } = renderHook(({ id }) => useRecipeDetail(id), { initialProps: { id: 10 } });
  await waitFor(() => expect(result.current.recipe?.id).toBe(10));
  let pending!: Promise<void>;
  act(() => { pending = result.current.scaleToMultiplier("2"); });
  expect(result.current.scaling).toBe(true);
  rerender({ id: 20 });
  await waitFor(() => expect(result.current.recipe?.id).toBe(20));
  await act(async () => { resolve({ recipe_id: 10, factor: 2, base_servings: 4, target_servings: 8, ingredients: [], steps: [], warnings: [] }); await pending; });
  expect(result.current.scaling).toBe(false);
  expect(result.current.appliedMultiplier).toBe("1");
});
