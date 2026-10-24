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

  it("loads recipes independently of taxonomy and does not refetch taxonomy for filters", async () => {
    vi.mocked(apiClient.listRecipeCategories).mockImplementation(
      () => new Promise(() => {}),
    );
    const { result } = renderHook(() => useRecipeOrganizer());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.recipes).toEqual([recipe]));
    expect(result.current.loading).toBe(false);
    act(() => result.current.setQuery("pancake"));
    await act(async () => result.current.refresh());
    expect(apiClient.listRecipeCategories).toHaveBeenCalledTimes(1);
    expect(apiClient.listRecipeTags).toHaveBeenCalledTimes(1);
    expect(result.current.hasAppliedFilters).toBe(true);
  });

  it("keeps a newer search result when an older request resolves late", async () => {
    const { result } = renderHook(() => useRecipeOrganizer());
    await waitFor(() => expect(result.current.recipes).toEqual([recipe]));
    let finish!: (rows: RecipeDetail[]) => void;
    vi.mocked(apiClient.listRecipes)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValueOnce([]);
    act(() => result.current.setQuery("old"));
    let old!: Promise<void>;
    act(() => {
      old = result.current.refresh();
    });
    act(() => result.current.setQuery("new"));
    await act(async () => result.current.refresh());
    await act(async () => {
      finish([recipe]);
      await old;
    });
    expect(result.current.recipes).toEqual([]);
    expect(result.current.loading).toBe(false);
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

    expect(importRecipe).toHaveBeenCalledWith("https://example.com/pancakes");
    expect(imported).toEqual(recipe);
    expect(result.current.importUrl).toBe("");
    expect(result.current.message).toBe("Imported Pancakes.");
    expect(apiClient.listRecipes).toHaveBeenCalledTimes(2);
  });

  it("locks a pending create synchronously and preserves edits made while it saves", async () => {
    let finish!: (saved: RecipeDetail) => void;
    const create = vi.spyOn(apiClient, "createRecipe").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useRecipeOrganizer());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() =>
      result.current.setPayload((value) => ({ ...value, title: "First" })),
    );
    let pending!: Promise<RecipeDetail | null>;
    act(() => {
      pending = result.current.createRecipe();
      void result.current.createRecipe();
    });
    expect(create).toHaveBeenCalledTimes(1);
    act(() =>
      result.current.setPayload((value) => ({
        ...value,
        title: "Replacement",
      })),
    );
    await act(async () => {
      finish(recipe);
      await pending;
    });
    expect(result.current.payload.title).toBe("Replacement");
  });

  it("rejects stale create handlers after management is revoked", async () => {
    const create = vi
      .spyOn(apiClient, "createRecipe")
      .mockResolvedValue(recipe);
    const { result, rerender } = renderHook(
      ({ canManage }) => useRecipeOrganizer("new", canManage),
      { initialProps: { canManage: true } },
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() =>
      result.current.setPayload((value) => ({ ...value, title: "Draft" })),
    );
    const staleCreate = result.current.createRecipe;
    rerender({ canManage: false });
    await act(async () => staleCreate());
    expect(create).not.toHaveBeenCalled();
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
    expect(result.current.message).toBe("Imported 1 recipes from backup.");
  });
});
