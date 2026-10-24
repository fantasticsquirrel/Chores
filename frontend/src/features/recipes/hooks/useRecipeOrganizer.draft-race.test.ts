import { act, renderHook, waitFor } from "@testing-library/react";
import { apiClient, type RecipeDetail } from "../../../api";
import { useRecipeOrganizer } from "./useRecipeOrganizer";

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
it("does not erase a replacement draft when an earlier recipe save finishes", async () => {
  vi.spyOn(apiClient, "listRecipes").mockResolvedValue([]);
  vi.spyOn(apiClient, "listRecipeCategories").mockResolvedValue([]);
  vi.spyOn(apiClient, "listRecipeTags").mockResolvedValue([]);
  let resolve!: (value: RecipeDetail) => void;
  vi.spyOn(apiClient, "createRecipe").mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { result } = renderHook(() => useRecipeOrganizer());
  await waitFor(() => expect(result.current.loaded).toBe(true));
  act(() => result.current.setPayload((value) => ({ ...value, title: "First draft" })));
  let pending!: Promise<RecipeDetail | null>;
  act(() => { pending = result.current.createRecipe(); });
  // Back/Cancel can dismiss the task while the request is pending. A reopened
  // task can be edited before the original server response returns.
  act(() => result.current.setPayload((value) => ({ ...value, title: "Replacement draft" })));
  await act(async () => { resolve(recipe); await pending; });
  expect(result.current.payload.title).toBe("Replacement draft");
});
