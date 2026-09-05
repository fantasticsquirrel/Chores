import { act, renderHook, waitFor } from "@testing-library/react";

import {
  apiClient,
  type RecipeCategory,
  type RecipeDetail,
  type RecipeTag,
} from "../../../api";
import { useRecipeOrganizer } from "./useRecipeOrganizer";

const category: RecipeCategory = {
  id: 3,
  household_id: 7,
  owner_user_id: 2,
  name: "Dinner",
  color: "#f97316",
};

const tag: RecipeTag = {
  id: 4,
  household_id: 7,
  owner_user_id: 2,
  name: "Quick",
};

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
  categories: [category],
  tags: [tag],
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

describe("useRecipeOrganizer", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "listRecipeCategories").mockResolvedValue([category]);
    vi.spyOn(apiClient, "listRecipeTags").mockResolvedValue([tag]);
    vi.spyOn(apiClient, "listRecipes").mockResolvedValue([recipe]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads taxonomy and applies the existing recipe filter payload", async () => {
    const { result } = renderHook(() => useRecipeOrganizer());

    await waitFor(() => expect(result.current.recipes).toEqual([recipe]));
    act(() => {
      result.current.setQuery("pancake");
      result.current.setIngredient("flour");
      result.current.setCategoryId("3");
      result.current.setTagId("4");
      result.current.setFavoriteOnly(true);
      result.current.setMinRating("4");
    });
    await act(async () => result.current.refresh());

    expect(apiClient.listRecipes).toHaveBeenLastCalledWith({
      query: "pancake",
      ingredient: "flour",
      category_id: 3,
      tag_id: 4,
      favorite: true,
      min_rating: 4,
    });
  });

  it("trims URL imports, refreshes the cookbook, and returns the route target", async () => {
    const importRecipe = vi
      .spyOn(apiClient, "importRecipeFromUrl")
      .mockResolvedValue(recipe);
    const { result } = renderHook(() => useRecipeOrganizer());

    await waitFor(() => expect(result.current.recipes).toEqual([recipe]));
    act(() => result.current.setImportUrl("  https://example.com/pancakes  "));
    let imported: RecipeDetail | null = null;
    await act(async () => {
      imported = await result.current.importRecipeFromUrl();
    });

    expect(importRecipe).toHaveBeenCalledWith(
      "https://example.com/pancakes",
    );
    expect(imported).toEqual(recipe);
    expect(result.current.importUrl).toBe("");
    expect(result.current.message).toBe("Imported Pancakes.");
    expect(apiClient.listRecipes).toHaveBeenCalledTimes(2);
  });

  it("maps portable backup details back to the established import payload", async () => {
    const importBackup = vi
      .spyOn(apiClient, "importRecipeBackup")
      .mockResolvedValue({ imported_count: 1, recipes: [recipe] });
    const { result } = renderHook(() => useRecipeOrganizer());

    await waitFor(() => expect(result.current.recipes).toEqual([recipe]));
    act(() =>
      result.current.setBackupJson(JSON.stringify({ recipes: [recipe] })),
    );
    await act(async () => result.current.importBackup());

    expect(importBackup).toHaveBeenCalledWith([
      expect.objectContaining({
        title: "Pancakes",
        category_ids: [],
        tag_ids: [],
        components: [],
      }),
    ]);
    expect(result.current.backupJson).toBe("");
    expect(result.current.message).toBe(
      "Imported 1 recipes from backup.",
    );
  });
});
