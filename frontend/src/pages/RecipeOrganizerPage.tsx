import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  apiClient,
  type AuthUser,
  type Child,
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

function displayIngredientQuantity(row: RecipeDetail["ingredients"][number] | RecipeScaleResponse["ingredients"][number]): number | null {
  if ("scaled_quantity" in row) {
    const scaledQuantity = row.scaled_quantity;
    if (typeof scaledQuantity === "number" || scaledQuantity === null) {
      return scaledQuantity;
    }
  }

  return row.quantity;
}

function displayStepInstruction(step: RecipeDetail["steps"][number] | RecipeScaleResponse["steps"][number]): string {
  if ("scaled_instruction" in step && typeof step.scaled_instruction === "string") {
    return step.scaled_instruction;
  }

  return step.instruction;
}

function formatScaleInput(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

export function RecipeOrganizerPage(): ReactElement {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [editing, setEditing] = useState(false);
  const [payload, setPayload] = useState<CreateRecipeRequest>(emptyRecipePayload());
  const [linkFirstIngredientToStep, setLinkFirstIngredientToStep] = useState(true);
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


  async function handleFilter(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await refresh();
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const ingredients = (payload.ingredients ?? []).filter((row) => row.item.trim().length > 0);
      let steps = (payload.steps ?? []).filter((row) => row.instruction.trim().length > 0);
      if (linkFirstIngredientToStep && ingredients.length > 0 && steps.length > 0) {
        steps = steps.map((row, index) => (index === 0 ? { ...row, ingredient_position_refs: [ingredients[0].position] } : row));
      }
      const saved = await apiClient.createRecipe({
        ...payload,
        title: payload.title.trim(),
        ingredients,
        steps,
      });
      setMessage(`Saved ${saved.title}.`);
      setEditing(false);
      setPayload(emptyRecipePayload());
      setLinkFirstIngredientToStep(true);
      await refresh();
      navigate(`/recipes/${saved.id}`);
    } catch (saveError: unknown) {
      setError(errorText(saveError));
    }
  }

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
            <FormField label="Default Servings">
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
            <label>
              <input type="checkbox" checked={linkFirstIngredientToStep} onChange={(event) => setLinkFirstIngredientToStep(event.target.checked)} /> Link first ingredient to this step for scaling
            </label>
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
            <Link className="jewel-button button-reset" to={`/recipes/${recipe.id}`}>View {recipe.title}</Link>
          </Card>
        ))}
      </section>
    </>
  );
}

export function RecipeDetailPage(): ReactElement {
  const { recipeId } = useParams();
  const parsedRecipeId = Number(recipeId);
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [scaled, setScaled] = useState<RecipeScaleResponse | null>(null);
  const [targetServings, setTargetServings] = useState("8");
  const [scaleMultiplier, setScaleMultiplier] = useState("1");
  const [children, setChildren] = useState<Child[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [feedbackReviewerType, setFeedbackReviewerType] = useState<"PARENT" | "CHILD">("PARENT");
  const [feedbackChildId, setFeedbackChildId] = useState("");
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackVerdict, setFeedbackVerdict] = useState("");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadRecipe(): Promise<void> {
      setError(null);
      if (!Number.isInteger(parsedRecipeId) || parsedRecipeId <= 0) {
        setError("Recipe not found.");
        return;
      }
      try {
        const detail = await apiClient.getRecipe(parsedRecipeId);
        setRecipe(detail);
        setScaled(null);
        setTargetServings(detail.servings !== null ? String(detail.servings) : "");
        setScaleMultiplier("1");
        const session = await apiClient.getCurrentSession();
        setCurrentUser(session.user);
        const childRows = await apiClient.listChildren({ household_id: detail.household_id, active_only: true });
        setChildren(childRows);
        setFeedbackChildId(childRows[0]?.id !== undefined ? String(childRows[0].id) : "");
      } catch (loadError: unknown) {
        setError(errorText(loadError));
      }
    }

    void loadRecipe();
  }, [parsedRecipeId]);

  async function handleServingScale(value: string): Promise<void> {
    setTargetServings(value);
    if (recipe === null) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    if (recipe.servings !== null && recipe.servings > 0) {
      setScaleMultiplier(formatScaleInput(numeric / recipe.servings));
    }
    const preview = await apiClient.scaleRecipe(recipe.id, { targetServings: numeric });
    setScaled(preview);
  }

  async function handleMultiplierScale(value: string): Promise<void> {
    setScaleMultiplier(value);
    if (recipe === null) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    if (recipe.servings !== null && recipe.servings > 0) {
      setTargetServings(formatScaleInput(recipe.servings * numeric));
    }
    const preview = await apiClient.scaleRecipe(recipe.id, { scaleFactor: numeric });
    setScaled(preview);
  }

  async function reloadRecipe(recipeIdToLoad: number): Promise<void> {
    const detail = await apiClient.getRecipe(recipeIdToLoad);
    setRecipe(detail);
  }

  async function handleAddVariant(): Promise<void> {
    if (recipe === null) return;
    setError(null);
    try {
      const variant = await apiClient.duplicateRecipe(recipe.id, { title: `${recipe.title} Variant`, as_variant: true });
      setMessage(`Created variant ${variant.title}.`);
      await reloadRecipe(recipe.id);
    } catch (variantError: unknown) {
      setError(errorText(variantError));
    }
  }

  async function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (recipe === null || currentUser === null) return;
    const numericRating = feedbackRating === "" ? null : Number(feedbackRating);
    if (numericRating !== null && (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5)) return;
    setError(null);
    try {
      await apiClient.upsertRecipeFeedback(recipe.id, {
        reviewer_type: feedbackReviewerType,
        parent_user_id: feedbackReviewerType === "PARENT" ? currentUser.id : null,
        child_id: feedbackReviewerType === "CHILD" ? Number(feedbackChildId) : null,
        rating: numericRating,
        verdict: feedbackVerdict,
        notes: feedbackNotes,
      });
      setMessage("Saved family feedback.");
      setFeedbackVerdict("");
      setFeedbackNotes("");
      await reloadRecipe(recipe.id);
    } catch (feedbackError: unknown) {
      setError(errorText(feedbackError));
    }
  }

  const displayedIngredients = scaled?.ingredients ?? recipe?.ingredients ?? [];

  if (error !== null) {
    return (
      <Card as="section">
        <Link to="/recipes">Back to Recipes</Link>
        <InlineNotice variant="error">{error}</InlineNotice>
      </Card>
    );
  }

  if (recipe === null) {
    return (
      <Card as="section">
        <p className="eyebrow">Recipe Organizer</p>
        <h1>Loading Recipe</h1>
        <p>Opening the recipe cooking page.</p>
      </Card>
    );
  }

  const displayedSteps = scaled?.steps ?? recipe.steps;

  return (
    <Card as="section">
      <Link to="/recipes">Back to Recipes</Link>
      {message !== null ? <InlineNotice variant="success">{message}</InlineNotice> : null}
      <p className="eyebrow">Recipe Cooking Page</p>
      <h1>{recipe.title}</h1>
      {recipe.core_recipe !== null ? <p>Core recipe: <Link to={`/recipes/${recipe.core_recipe.id}`}>{recipe.core_recipe.title}</Link></p> : null}
      <p>{recipe.description}</p>
      {recipe.source_url !== null ? <p>Source: <a href={recipe.source_url}>{recipe.source_name || recipe.source_url}</a></p> : null}
      <p>{recipe.categories.map((row) => row.name).join(", ")}</p>
      <p>{recipe.tags.map((row) => row.name).join(", ")}</p>
      <p>{recipe.favorite ? "Favorite" : ""} {recipe.rating !== null ? `Rating ${recipe.rating}` : ""}</p>
      <p>{recipe.notes}</p>
      <p>Default servings: {recipe.servings !== null ? formatQuantity(recipe.servings) : "not set"}</p>
      <FormField label="Scaled Servings">
        <TextInput type="number" value={targetServings} onChange={(event) => { void handleServingScale(event.target.value); }} />
      </FormField>
      <FormField label="Scale Multiplier">
        <TextInput type="number" step="0.25" value={scaleMultiplier} onChange={(event) => { void handleMultiplierScale(event.target.value); }} />
      </FormField>
      <h2>Ingredients</h2>
      <ul>
        {displayedIngredients.map((row) => (
          <li key={row.id}>
            <label>
              <input type="checkbox" /> {formatQuantity(displayIngredientQuantity(row))} {row.unit} {row.item}
            </label>
          </li>
        ))}
      </ul>
      <h2>Steps</h2>
      <ol>
        {displayedSteps.map((step) => <li key={step.id}>{displayStepInstruction(step)}</li>)}
      </ol>
      <h2>Recipe Variants</h2>
      <p>Use variants for varieties like gluten-free, spicy, kid-friendly, or batch-size versions that stay attached to this core recipe.</p>
      <Button type="button" onClick={() => { void handleAddVariant(); }}>Add Variant</Button>
      {recipe.variants.length > 0 ? (
        <ul>
          {recipe.variants.map((row) => <li key={row.id}><Link to={`/recipes/${row.id}`}>{row.title}</Link></li>)}
        </ul>
      ) : <p>No variants yet.</p>}
      {recipe.components.length > 0 ? <p>Sub-recipes: {recipe.components.map((row) => row.component_recipe.title).join(", ")}</p> : null}
      <h2>Family Feedback</h2>
      <p>Average family rating: {recipe.feedback_summary.average_rating ?? "not rated"} ({recipe.feedback_summary.rating_count} ratings)</p>
      <form onSubmit={(event) => { void handleFeedbackSubmit(event); }}>
        <FormField label="Feedback For">
          <select value={feedbackReviewerType} onChange={(event) => setFeedbackReviewerType(event.target.value as "PARENT" | "CHILD")}>
            <option value="PARENT">Parent</option>
            <option value="CHILD">Child</option>
          </select>
        </FormField>
        {feedbackReviewerType === "CHILD" ? (
          <FormField label="Child">
            <select value={feedbackChildId} onChange={(event) => setFeedbackChildId(event.target.value)}>
              {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
            </select>
          </FormField>
        ) : null}
        <FormField label="Family Rating">
          <TextInput type="number" min="1" max="5" value={feedbackRating} onChange={(event) => setFeedbackRating(event.target.value)} />
        </FormField>
        <FormField label="Verdict">
          <TextInput value={feedbackVerdict} onChange={(event) => setFeedbackVerdict(event.target.value)} placeholder="Loved it, okay, too spicy..." />
        </FormField>
        <FormField label="Feedback Notes">
          <TextInput value={feedbackNotes} onChange={(event) => setFeedbackNotes(event.target.value)} />
        </FormField>
        <Button type="submit">Save Feedback</Button>
      </form>
      {recipe.feedback.length > 0 ? (
        <ul>
          {recipe.feedback.map((row) => (
            <li key={row.id}>{row.reviewer_name}: {row.rating !== null ? `${row.rating}/5` : "not rated"} {row.verdict} {row.notes}</li>
          ))}
        </ul>
      ) : <p>No family feedback yet.</p>}
    </Card>
  );
}
