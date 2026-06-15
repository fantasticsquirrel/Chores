import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { apiClient, type RecipeDetail, type RecipeSummary } from "./api";

const category = { id: 1, household_id: 1, owner_user_id: 1, name: "Dinner", color: "#f97316" };
const tag = { id: 2, household_id: 1, owner_user_id: 1, name: "Quick" };
const recipe: RecipeDetail = {
  id: 10,
  household_id: 1,
  owner_user_id: 1,
  parent_recipe_id: null,
  title: "Pancakes",
  description: "Weekend breakfast",
  photo_url: "https://example.com/pancakes.jpg",
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
  feedback_summary: { average_rating: 4, rating_count: 2 },
  ingredients: [{ id: 100, recipe_id: 10, position: 1, group_name: "Batter", quantity: 2, unit: "cup", item: "flour", preparation: "", note: "", is_optional: false }],
  steps: [{ id: 200, recipe_id: 10, position: 1, section: "Cook", instruction: "Cook with flour on a hot griddle.", ingredient_position_refs: [1], ingredient_ids: [100] }],
  components: [],
  variants: [{ id: 11, household_id: 1, owner_user_id: 1, parent_recipe_id: 10, title: "Blueberry Pancakes", description: "", photo_url: null, source_name: "", source_url: null, prep_minutes: null, cook_minutes: null, servings: 4, yield_quantity: null, yield_unit: "", rating: null, favorite: false, notes: "", archived_at: null, categories: [], tags: [], ingredient_count: 0, feedback_summary: { average_rating: null, rating_count: 0 } }],
  core_recipe: null,
  feedback: [
    { id: 500, recipe_id: 10, household_id: 1, reviewer_type: "PARENT", parent_user_id: 1, child_id: null, reviewer_name: "parent@example.com", rating: 5, verdict: "Loved it", notes: "Make again.", created_at: "2026-06-14T00:00:00Z" },
    { id: 501, recipe_id: 10, household_id: 1, reviewer_type: "CHILD", parent_user_id: null, child_id: 7, reviewer_name: "Kid", rating: 3, verdict: "Okay", notes: "Less spice.", created_at: "2026-06-14T00:00:00Z" },
  ],
};

function mockRecipeApi(recipes: RecipeSummary[] = [recipe]): void {
  vi.spyOn(apiClient, "getMyModules").mockResolvedValue({
    modules: [
      { key: "chores", name: "Chores", description: "" },
      { key: "recipes", name: "Recipes", description: "" },
    ],
  });
  vi.spyOn(apiClient, "listRecipeCategories").mockResolvedValue([category]);
  vi.spyOn(apiClient, "listRecipeTags").mockResolvedValue([tag]);
  vi.spyOn(apiClient, "listRecipes").mockResolvedValue(recipes);
  vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({ user: { id: 1, household_id: 1, email: "parent@example.com", role: "PARENT" }, csrf_token: "token" });
  vi.spyOn(apiClient, "listChildren").mockResolvedValue([{ id: 7, household_id: 1, name: "Kid", active: true }]);
  vi.spyOn(apiClient, "upsertRecipeFeedback").mockResolvedValue(recipe.feedback[0]);
  vi.spyOn(apiClient, "duplicateRecipe").mockResolvedValue({ ...recipe, id: 12, title: "Pancakes Variant", parent_recipe_id: 10, variants: [] });
  vi.spyOn(apiClient, "deleteRecipe").mockResolvedValue(undefined);
  vi.spyOn(apiClient, "getRecipe").mockResolvedValue(recipe);
  vi.spyOn(apiClient, "scaleRecipe").mockResolvedValue({
    recipe_id: 10,
    base_servings: 4,
    target_servings: 8,
    factor: 2,
    warnings: [],
    ingredients: [{ ...recipe.ingredients[0], scaled_quantity: 4 }],
    steps: [{ ...recipe.steps[0], scaled_instruction: "Cook with flour on a hot griddle. Uses: 4 cup flour.", linked_ingredients: [{ ...recipe.ingredients[0], scaled_quantity: 4 }] }],
  });
}

describe("Recipe organizer page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders parent-owned recipes with filters and links to a standalone cooking detail page", async () => {
    mockRecipeApi();

    render(
      <MemoryRouter initialEntries={["/recipes"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Recipe Organizer" })).toBeVisible();
    expect(await screen.findByText("Pancakes")).toBeVisible();
    expect(screen.getByRole("img", { name: "Pancakes" })).toHaveAttribute("src", "https://example.com/pancakes.jpg");
    expect(screen.getByText("Dinner")).toBeVisible();
    expect(screen.getByText("#Quick")).toBeVisible();

    fireEvent.click(screen.getByRole("link", { name: "View Recipe" }));
    await waitFor(() => expect(apiClient.getRecipe).toHaveBeenCalledWith(10));
    expect(await screen.findByRole("heading", { name: "Pancakes" })).toBeVisible();
    expect(screen.getByText("Default servings: 4")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Scaled Servings"), { target: { value: "8" } });
    await waitFor(() => expect(apiClient.scaleRecipe).toHaveBeenCalledWith(10, { targetServings: 8 }));
    expect(screen.getByLabelText("Scale Multiplier")).toHaveValue(2);
    await waitFor(() => expect(screen.getAllByText("4 cup flour").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Cook with flour on a hot griddle. Uses: 4 cup flour.").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Recipe Variants" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Blueberry Pancakes" })).toHaveAttribute("href", "/recipes/11");
    expect(screen.getByRole("heading", { name: "Family Feedback" })).toBeVisible();
    expect(screen.getByText("Average family rating: 4 (2 ratings)")).toBeVisible();
    expect(screen.getByText(/parent@example.com: 5\/5 Loved it Make again\./)).toBeVisible();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(printSpy).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByLabelText("Feedback For"), { target: { value: "CHILD" } });
    fireEvent.change(screen.getByLabelText("Family Rating"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Verdict"), { target: { value: "Good" } });
    fireEvent.change(screen.getByLabelText("Feedback Notes"), { target: { value: "Needs syrup." } });
    fireEvent.click(screen.getByRole("button", { name: "Save Feedback" }));
    await waitFor(() => expect(apiClient.upsertRecipeFeedback).toHaveBeenCalledWith(10, expect.objectContaining({
      reviewer_type: "CHILD",
      child_id: 7,
      rating: 4,
      verdict: "Good",
      notes: "Needs syrup.",
    })));

    fireEvent.click(screen.getByRole("button", { name: "Add Variant" }));
    await waitFor(() => expect(apiClient.duplicateRecipe).toHaveBeenCalledWith(10, { title: "Pancakes Variant", as_variant: true }));

    fireEvent.change(screen.getByLabelText("Scale Multiplier"), { target: { value: "1.5" } });
    await waitFor(() => expect(apiClient.scaleRecipe).toHaveBeenLastCalledWith(10, { scaleFactor: 1.5 }));
    expect(screen.getByLabelText("Scaled Servings")).toHaveValue(6);
  });

  it("loads recipe cooking detail directly from its own route", async () => {
    mockRecipeApi();

    render(
      <MemoryRouter initialEntries={["/recipes/10"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Pancakes" })).toBeVisible();
    expect(apiClient.getRecipe).toHaveBeenCalledWith(10);
    expect(screen.getAllByText("Rest batter.").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Back to Recipes" })).toHaveAttribute("href", "/recipes");
  });

  it("requires typing the recipe title before deleting a recipe", async () => {
    mockRecipeApi();

    render(
      <MemoryRouter initialEntries={["/recipes/10"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Pancakes" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Delete Recipe" }));
    expect(screen.getByRole("dialog", { name: "Delete recipe confirmation" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Permanently Delete" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type recipe title to delete"), { target: { value: "Pancakes" } });
    fireEvent.click(screen.getByRole("button", { name: "Permanently Delete" }));
    await waitFor(() => expect(apiClient.deleteRecipe).toHaveBeenCalledWith(10));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Recipe Organizer" })).toBeVisible());
  });

  it("creates a recipe for the signed-in parent account", async () => {
    mockRecipeApi([]);
    const createRecipeSpy = vi.spyOn(apiClient, "createRecipe").mockResolvedValue(recipe);

    render(
      <MemoryRouter initialEntries={["/recipes"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Recipe Organizer" });
    fireEvent.click(screen.getByRole("button", { name: "New Recipe" }));
    const editor = screen.getByRole("heading", { name: "Recipe Editor" }).closest("article");
    expect(editor).not.toBeNull();
    fireEvent.change(within(editor as HTMLElement).getByLabelText("Title"), { target: { value: "Pancakes" } });
    fireEvent.change(within(editor as HTMLElement).getByLabelText("Recipe Photo URL"), { target: { value: "https://example.com/pancakes.jpg" } });
    fireEvent.change(within(editor as HTMLElement).getByLabelText("Default Servings"), { target: { value: "4" } });
    fireEvent.change(within(editor as HTMLElement).getByLabelText("Ingredient Item"), { target: { value: "flour" } });
    fireEvent.change(within(editor as HTMLElement).getByLabelText("Ingredient Quantity"), { target: { value: "2" } });
    fireEvent.change(within(editor as HTMLElement).getByLabelText("Ingredient Unit"), { target: { value: "cup" } });
    fireEvent.change(within(editor as HTMLElement).getByLabelText("Step Instruction"), { target: { value: "Cook on a hot griddle." } });
    fireEvent.click(within(editor as HTMLElement).getByRole("button", { name: "Save Recipe" }));

    await waitFor(() => expect(createRecipeSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: "Pancakes",
      photo_url: "https://example.com/pancakes.jpg",
      servings: 4,
      ingredients: [expect.objectContaining({ item: "flour", quantity: 2, unit: "cup" })],
      steps: [expect.objectContaining({ instruction: "Cook on a hot griddle.", ingredient_position_refs: [1] })],
    })));
  });
});
