import { act, renderHook, waitFor } from "@testing-library/react";

import {
  apiClient,
  type RecipeCategory,
  type RecipeDetail,
  type RecipeTag,
} from "../../../api";
import { useRecipeDetail } from "./useRecipeDetail";

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

describe("useRecipeDetail", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "getRecipe").mockResolvedValue(recipe);
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 2,
        household_id: 7,
        email: "parent@example.com",
        role: "PARENT",
        is_household_owner: false,
        child_id: null,
      },
      csrf_token: "token",
    });
    vi.spyOn(apiClient, "listChildren").mockResolvedValue([
      { id: 11, household_id: 7, name: "Riley", active: true },
    ]);
    vi.spyOn(apiClient, "listRecipes").mockResolvedValue([recipe]);
    vi.spyOn(apiClient, "listRecipeCategories").mockResolvedValue([category]);
    vi.spyOn(apiClient, "listRecipeTags").mockResolvedValue([tag]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads related detail data with the recipe household and preserves scaling payloads", async () => {
    vi.spyOn(apiClient, "scaleRecipe").mockResolvedValue({
      recipe_id: 10,
      base_servings: 4,
      target_servings: 8,
      factor: 2,
      warnings: [],
      ingredients: [{ ...recipe.ingredients[0], scaled_quantity: 4 }],
      steps: [
        {
          ...recipe.steps[0],
          scaled_instruction: "Cook on a hot griddle.",
          linked_ingredients: [
            { ...recipe.ingredients[0], scaled_quantity: 4 },
          ],
        },
      ],
    });
    const { result } = renderHook(() => useRecipeDetail(10));

    await waitFor(() => expect(result.current.recipe).toEqual(recipe));
    await waitFor(() => expect(result.current.children).toHaveLength(1));
    expect(apiClient.listChildren).toHaveBeenCalledWith({
      household_id: 7,
      active_only: true,
    });
    await act(async () => result.current.scaleToServings("8"));

    expect(apiClient.scaleRecipe).toHaveBeenCalledWith(10, {
      targetServings: 8,
    });
    expect(result.current.scaleMultiplier).toBe("2");
    expect(result.current.linkedCurrentIngredients[0]).toMatchObject({
      scaled_quantity: 4,
    });
    expect(result.current.displayedIngredients[0]).toMatchObject({
      scaled_quantity: 4,
    });
  });

  it("keeps scale output bound to the latest request and reports failure without replacing the recipe", async () => {
    let old!: (
      value: Awaited<ReturnType<typeof apiClient.scaleRecipe>>,
    ) => void;
    const scaled = {
      recipe_id: 10,
      base_servings: 4,
      target_servings: 12,
      factor: 3,
      warnings: [],
      ingredients: [{ ...recipe.ingredients[0], scaled_quantity: 6 }],
      steps: [],
    };
    vi.spyOn(apiClient, "scaleRecipe")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            old = resolve;
          }),
      )
      .mockResolvedValueOnce(scaled)
      .mockRejectedValueOnce(new Error("Offline"));
    const { result } = renderHook(() => useRecipeDetail(10));
    await waitFor(() => expect(result.current.recipe).toEqual(recipe));
    let earlier!: Promise<void>;
    act(() => {
      earlier = result.current.scaleToServings("8");
    });
    await act(async () => result.current.scaleToServings("12"));
    await act(async () => {
      old({ ...scaled, target_servings: 8, factor: 2 });
      await earlier;
    });
    expect(result.current.appliedServings).toBe("12");
    await act(async () => result.current.scaleToServings("16"));
    expect(result.current.scaleError).toContain("Offline");
    expect(result.current.appliedServings).toBe("12");
    expect(result.current.recipe).toEqual(recipe);
  });

  it("rejects stale mutation handlers after management is revoked", async () => {
    const update = vi
      .spyOn(apiClient, "updateRecipe")
      .mockResolvedValue(recipe);
    const duplicate = vi
      .spyOn(apiClient, "duplicateRecipe")
      .mockResolvedValue(recipe);
    const remove = vi
      .spyOn(apiClient, "deleteRecipe")
      .mockResolvedValue(undefined);
    const feedback = vi.spyOn(apiClient, "upsertRecipeFeedback");
    const { result, rerender } = renderHook(
      ({ canManage }) => useRecipeDetail(10, { canManage }),
      { initialProps: { canManage: true } },
    );
    await waitFor(() => expect(result.current.recipe).toEqual(recipe));
    act(() => result.current.setDeleteConfirmText(recipe.title));
    const stale = {
      update: result.current.updateRecipe,
      duplicate: result.current.addVariant,
      remove: result.current.deleteRecipe,
      feedback: result.current.saveFeedback,
    };
    rerender({ canManage: false });
    await act(async () => {
      await stale.update();
      await stale.duplicate();
      await stale.remove();
      await stale.feedback();
    });
    for (const operation of [update, duplicate, remove, feedback])
      expect(operation).not.toHaveBeenCalled();
  });

  it("keeps the reviewer identity payload tied to the loaded session and child", async () => {
    const upsertFeedback = vi
      .spyOn(apiClient, "upsertRecipeFeedback")
      .mockResolvedValue({
        id: 50,
        recipe_id: 10,
        household_id: 7,
        reviewer_type: "CHILD",
        parent_user_id: null,
        child_id: 11,
        reviewer_name: "Riley",
        rating: 4,
        verdict: "Good",
        notes: "Needs syrup.",
        created_at: "2026-09-05T00:00:00Z",
      });
    const { result } = renderHook(() => useRecipeDetail(10));

    await waitFor(() => expect(result.current.children).toHaveLength(1));
    act(() => {
      result.current.setFeedbackReviewerType("CHILD");
      result.current.setFeedbackRating("4");
      result.current.setFeedbackVerdict("Good");
      result.current.setFeedbackNotes("Needs syrup.");
    });
    await act(async () => result.current.saveFeedback());

    expect(upsertFeedback).toHaveBeenCalledWith(10, {
      reviewer_type: "CHILD",
      parent_user_id: null,
      child_id: 11,
      rating: 4,
      verdict: "Good",
      notes: "Needs syrup.",
    });
    expect(result.current.message).toBe("Saved family feedback.");
    expect(result.current.feedbackVerdict).toBe("");
    expect(result.current.feedbackNotes).toBe("");
  });

  it("requires the exact title before issuing the existing delete request", async () => {
    const deleteRecipe = vi
      .spyOn(apiClient, "deleteRecipe")
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useRecipeDetail(10));

    await waitFor(() => expect(result.current.recipe).toEqual(recipe));
    let deleted = true;
    await act(async () => {
      deleted = await result.current.deleteRecipe();
    });
    expect(deleted).toBe(false);
    expect(deleteRecipe).not.toHaveBeenCalled();

    act(() => result.current.setDeleteConfirmText("Pancakes"));
    await act(async () => {
      deleted = await result.current.deleteRecipe();
    });
    expect(deleted).toBe(true);
    expect(deleteRecipe).toHaveBeenCalledWith(10);
  });
});
