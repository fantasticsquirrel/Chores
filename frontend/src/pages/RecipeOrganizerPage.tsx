import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";

import {
  apiClient,
  type CreateRecipeRequest,
  type RecipeCategory,
  type RecipeDetail,
  type RecipeScaleResponse,
  type RecipeSummary,
  type RecipeTag,
} from "../api";
import { Button, Card, FormField, InlineNotice, TextInput } from "../ui";
import { formatQuantity } from "./recipes/scaling";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Recipe request failed.";
}

function emptyRecipePayload(): CreateRecipeRequest {
  return {
    title: "",
    servings: null,
    favorite: false,
    rating: null,
    category_ids: [],
    tag_ids: [],
    ingredients: [{ position: 1, group_name: "", quantity: null, unit: "", item: "", preparation: "", note: "", is_optional: false }],
    steps: [{ position: 1, section: "", instruction: "" }],
    components: [],
  };
}

export function RecipeOrganizerPage(): ReactElement {
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetail | null>(null);
  const [scaled, setScaled] = useState<RecipeScaleResponse | null>(null);
  const [targetServings, setTargetServings] = useState("8");
  const [editing, setEditing] = useState(false);
  const [payload, setPayload] = useState<CreateRecipeRequest>(emptyRecipePayload());
  const [query, setQuery] = useState("");
  const [ingredient, setIngredient] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setError(null);
    try {
      const [categoryRows, tagRows, recipeRows] = await Promise.all([
        apiClient.listRecipeCategories(),
        apiClient.listRecipeTags(),
        apiClient.listRecipes({ query: query || undefined, ingredient: ingredient || undefined }),
      ]);
      setCategories(categoryRows);
      setTags(tagRows);
      setRecipes(recipeRows);
    } catch (loadError: unknown) {
      setError(errorText(loadError));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openRecipe(recipeId: number): Promise<void> {
    setError(null);
    try {
      const detail = await apiClient.getRecipe(recipeId);
      setSelectedRecipe(detail);
      setScaled(null);
      if (detail.servings !== null) setTargetServings(String(detail.servings));
    } catch (loadError: unknown) {
      setError(errorText(loadError));
    }
  }

  async function handleScale(value: string): Promise<void> {
    setTargetServings(value);
    if (selectedRecipe === null) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const preview = await apiClient.scaleRecipe(selectedRecipe.id, numeric);
    setScaled(preview);
  }

  async function handleFilter(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await refresh();
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const saved = await apiClient.createRecipe({
        ...payload,
        title: payload.title.trim(),
        ingredients: (payload.ingredients ?? []).filter((row) => row.item.trim().length > 0),
        steps: (payload.steps ?? []).filter((row) => row.instruction.trim().length > 0),
      });
      setMessage(`Saved ${saved.title}.`);
      setEditing(false);
      setPayload(emptyRecipePayload());
      await refresh();
      setSelectedRecipe(saved);
      if (saved.servings !== null) setTargetServings(String(saved.servings));
    } catch (saveError: unknown) {
      setError(errorText(saveError));
    }
  }

  const displayedIngredients = scaled?.ingredients ?? selectedRecipe?.ingredients ?? [];

  return (
    <>
      <Card as="section">
        <p className="eyebrow">Parent Account Recipes</p>
        <h1>Recipe Organizer</h1>
        <p>Store recipes per parent account with tags, ingredients, variants, sub-recipes, and scaling.</p>
        <p>{recipes.length} recipes · {categories.length} categories · {tags.length} tags</p>
        <Button type="button" onClick={() => setEditing(true)}>New Recipe</Button>
      </Card>

      {error !== null ? <InlineNotice variant="error">{error}</InlineNotice> : null}
      {message !== null ? <InlineNotice variant="success">{message}</InlineNotice> : null}

      <Card as="section">
        <h2>Find Recipes</h2>
        <form onSubmit={(event) => { void handleFilter(event); }}>
          <FormField label="Search">
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} />
          </FormField>
          <FormField label="Ingredient">
            <TextInput value={ingredient} onChange={(event) => setIngredient(event.target.value)} />
          </FormField>
          <Button type="submit">Apply Filters</Button>
        </form>
      </Card>

      {editing ? (
        <Card as="article">
          <h2>Recipe Editor</h2>
          <form onSubmit={(event) => { void handleSave(event); }}>
            <FormField label="Title">
              <TextInput value={payload.title} onChange={(event) => setPayload((prev) => ({ ...prev, title: event.target.value }))} required />
            </FormField>
            <FormField label="Servings">
              <TextInput type="number" value={payload.servings ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, servings: event.target.value === "" ? null : Number(event.target.value) }))} />
            </FormField>
            <FormField label="Ingredient Item">
              <TextInput value={payload.ingredients?.[0]?.item ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, ingredients: [{ ...(prev.ingredients?.[0] ?? { position: 1 }), position: 1, item: event.target.value }] }))} />
            </FormField>
            <FormField label="Ingredient Quantity">
              <TextInput type="number" value={payload.ingredients?.[0]?.quantity ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, ingredients: [{ ...(prev.ingredients?.[0] ?? { position: 1, item: "" }), position: 1, quantity: event.target.value === "" ? null : Number(event.target.value) }] }))} />
            </FormField>
            <FormField label="Ingredient Unit">
              <TextInput value={payload.ingredients?.[0]?.unit ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, ingredients: [{ ...(prev.ingredients?.[0] ?? { position: 1, item: "" }), position: 1, unit: event.target.value }] }))} />
            </FormField>
            <FormField label="Step Instruction">
              <TextInput value={payload.steps?.[0]?.instruction ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, steps: [{ ...(prev.steps?.[0] ?? { position: 1 }), position: 1, instruction: event.target.value }] }))} />
            </FormField>
            <Button type="submit">Save Recipe</Button>
          </form>
        </Card>
      ) : null}

      <section className="content-grid">
        {recipes.map((recipe) => (
          <Card as="article" key={recipe.id}>
            <h2>{recipe.title}</h2>
            <p>{recipe.description}</p>
            <p>{recipe.categories.map((row) => row.name).join(", ")}</p>
            <p>{recipe.tags.map((row) => row.name).join(", ")}</p>
            <p>{recipe.favorite ? "Favorite" : ""} {recipe.rating !== null ? `Rating ${recipe.rating}` : ""}</p>
            <Button type="button" onClick={() => { void openRecipe(recipe.id); }}>View {recipe.title}</Button>
          </Card>
        ))}
      </section>

      {selectedRecipe !== null ? (
        <Card as="section">
          <h2>{selectedRecipe.title}</h2>
          <p>{selectedRecipe.notes}</p>
          <FormField label="Target Servings">
            <TextInput type="number" value={targetServings} onChange={(event) => { void handleScale(event.target.value); }} />
          </FormField>
          <h3>Ingredients</h3>
          <ul>
            {displayedIngredients.map((row) => (
              <li key={row.id}>
                <label>
                  <input type="checkbox" /> {formatQuantity("scaled_quantity" in row ? row.scaled_quantity : row.quantity)} {row.unit} {row.item}
                </label>
              </li>
            ))}
          </ul>
          <h3>Steps</h3>
          <ol>
            {selectedRecipe.steps.map((step) => <li key={step.id}>{step.instruction}</li>)}
          </ol>
          {selectedRecipe.variants.length > 0 ? <p>Variants: {selectedRecipe.variants.map((row) => row.title).join(", ")}</p> : null}
          {selectedRecipe.components.length > 0 ? <p>Sub-recipes: {selectedRecipe.components.map((row) => row.component_recipe.title).join(", ")}</p> : null}
        </Card>
      ) : null}
    </>
  );
}
