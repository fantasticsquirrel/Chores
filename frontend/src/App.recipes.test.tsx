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
  ingredients: [{ id: 100, recipe_id: 10, position: 1, group_name: "Batter", quantity: 2, unit: "cup", item: "flour", preparation: "", note: "", is_optional: false }],
  steps: [{ id: 200, recipe_id: 10, position: 1, section: "Cook", instruction: "Cook with flour on a hot griddle.", ingredient_position_refs: [1], ingredient_ids: [100] }],
  components: [],
  variants: [],
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
    expect(screen.getByText("Dinner")).toBeVisible();
    expect(screen.getByText("Quick")).toBeVisible();

    fireEvent.click(screen.getByRole("link", { name: "View Pancakes" }));
    await waitFor(() => expect(apiClient.getRecipe).toHaveBeenCalledWith(10));
    expect(await screen.findByRole("heading", { name: "Pancakes" })).toBeVisible();
    expect(screen.getByText("Default servings: 4")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Scaled Servings"), { target: { value: "8" } });
    await waitFor(() => expect(apiClient.scaleRecipe).toHaveBeenCalledWith(10, { targetServings: 8 }));
    expect(screen.getByLabelText("Scale Multiplier")).toHaveValue(2);
    expect(await screen.findByText("4 cup flour")).toBeVisible();
    expect(await screen.findByText("Cook with flour on a hot griddle. Uses: 4 cup flour.")).toBeVisible();

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
    expect(screen.getByText("Rest batter.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Recipes" })).toHaveAttribute("href", "/recipes");
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
    fireEvent.change(within(editor as HTMLElement).getByLabelText("Default Servings"), { target: { value: "4" } });
    fireEvent.change(within(editor as HTMLElement).getByLabelText("Ingredient Item"), { target: { value: "flour" } });
    fireEvent.change(within(editor as HTMLElement).getByLabelText("Ingredient Quantity"), { target: { value: "2" } });
    fireEvent.change(within(editor as HTMLElement).getByLabelText("Ingredient Unit"), { target: { value: "cup" } });
    fireEvent.change(within(editor as HTMLElement).getByLabelText("Step Instruction"), { target: { value: "Cook on a hot griddle." } });
    fireEvent.click(within(editor as HTMLElement).getByRole("button", { name: "Save Recipe" }));

    await waitFor(() => expect(createRecipeSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: "Pancakes",
      servings: 4,
      ingredients: [expect.objectContaining({ item: "flour", quantity: 2, unit: "cup" })],
      steps: [expect.objectContaining({ instruction: "Cook on a hot griddle.", ingredient_position_refs: [1] })],
    })));
  });
});
