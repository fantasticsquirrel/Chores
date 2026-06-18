import type { FormEvent, ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
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
import { RecipeEditor } from "../features/recipes/components/RecipeEditor";
import {
  backupRecipeToPayload,
  buildEmptyRecipePayload,
  buildRecipePayloadForSave,
  displayStepInstruction,
  formatIngredientLine,
  formatScaleInput,
  payloadFromRecipe,
  recipeMetaPills,
  recipeTaxonomy,
} from "../features/recipes/lib/payloadMapping";
import { Button, Card, FormField, InlineNotice, TextInput } from "../ui";
import { formatQuantity } from "./recipes/scaling";

export function RecipeOrganizerPage(): ReactElement {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [editing, setEditing] = useState(false);
  const [payload, setPayload] = useState<CreateRecipeRequest>(buildEmptyRecipePayload());
  const [query, setQuery] = useState("");
  const [ingredient, setIngredient] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tagId, setTagId] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [minRating, setMinRating] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [backupJson, setBackupJson] = useState("");
  const [showBackupTools, setShowBackupTools] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setError(null);
    try {
      const [categoryRows, tagRows, recipeRows] = await Promise.all([
        apiClient.listRecipeCategories(),
        apiClient.listRecipeTags(),
        apiClient.listRecipes({
          query: query || undefined,
          ingredient: ingredient || undefined,
          category_id: categoryId === "" ? undefined : Number(categoryId),
          tag_id: tagId === "" ? undefined : Number(tagId),
          favorite: favoriteOnly ? true : undefined,
          min_rating: minRating === "" ? undefined : Number(minRating),
        }),
      ]);
      setCategories(categoryRows);
      setTags(tagRows);
      setRecipes(recipeRows);
    } catch (loadError: unknown) {
      setError(errorText(loadError));
    }
  }

  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFilter(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await refresh();
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const saved = await apiClient.createRecipe(buildRecipePayloadForSave(payload));
      setMessage(`Saved ${saved.title}.`);
      setEditing(false);
      setPayload(buildEmptyRecipePayload());
      await refresh();
      navigate(`/recipes/${saved.id}`);
    } catch (saveError: unknown) {
      setError(errorText(saveError));
    }
  }

  async function handleImportUrl(): Promise<void> {
    if (importUrl.trim() === "") return;
    setError(null);
    try {
      const imported = await apiClient.importRecipeFromUrl(importUrl.trim());
      setImportUrl("");
      setMessage(`Imported ${imported.title}.`);
      await refresh();
      navigate(`/recipes/${imported.id}`);
    } catch (importError: unknown) {
      setError(errorText(importError));
    }
  }

  async function handleExportBackup(): Promise<void> {
    const backup = await apiClient.exportRecipeBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "family-manager-recipes-backup.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${backup.recipes.length} recipes.`);
  }

  async function handleImportBackup(): Promise<void> {
    setError(null);
    try {
      const parsed = JSON.parse(backupJson) as { recipes?: RecipeDetail[] };
      const recipesToImport = (parsed.recipes ?? []).map(backupRecipeToPayload);
      const result = await apiClient.importRecipeBackup(recipesToImport);
      setBackupJson("");
      setMessage(`Imported ${result.imported_count} recipes from backup.`);
      await refresh();
    } catch (backupError: unknown) {
      setError(errorText(backupError));
    }
  }

  return (
    <>
      <Card as="section" className="recipe-page-card recipe-hero-card">
        <div>
          <p className="eyebrow">Parent Account Recipes</p>
          <h1>Recipe Organizer</h1>
          <p>Build a family cookbook with import, tags, variants, sub-recipes, backups, and cooking-mode scaling.</p>
          <div className="recipe-stat-strip" aria-label="Recipe organizer summary">
            <span>{recipes.length} recipes</span>
            <span>{categories.length} categories</span>
            <span>{tags.length} tags</span>
          </div>
        </div>
        <div className="recipe-hero-actions"><Button type="button" onClick={() => setEditing(true)}>New Recipe</Button><Button type="button" onClick={() => setShowBackupTools((value) => !value)}>{showBackupTools ? "Hide Backup" : "Backup & Restore"}</Button></div>
      </Card>

      {error !== null ? <InlineNotice variant="error">{error}</InlineNotice> : null}
      {message !== null ? <InlineNotice variant="success">{message}</InlineNotice> : null}

      <Card as="section" className="recipe-page-card recipe-tool-card">
        <div className="recipe-section-heading">
          <div>
            <p className="eyebrow">Quick Add</p>
            <h2>Add recipes quickly</h2>
            <p>Paste a recipe URL to import title, servings, ingredients, source attribution, and steps.</p>
          </div>
        </div>
        <div className="recipe-import-row">
          <FormField label="Import Recipe URL" className="recipe-form-field"><TextInput type="url" value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="https://example.com/recipe" /></FormField>
          <Button type="button" onClick={() => { void handleImportUrl(); }}>Import from URL</Button>
        </div>
        {showBackupTools ? (
          <div className="recipe-backup-panel">
            <div className="recipe-section-heading recipe-section-heading--compact">
              <div>
                <h3>Backup & Restore</h3>
                <p>Export a portable JSON backup or paste one here to restore recipes.</p>
              </div>
              <Button type="button" onClick={() => { void handleExportBackup(); }}>Export Backup</Button>
            </div>
            <FormField label="Import Backup JSON" className="recipe-form-field"><textarea value={backupJson} onChange={(event) => setBackupJson(event.target.value)} placeholder="Paste a Family Manager recipe backup JSON here." /></FormField>
            <Button type="button" onClick={() => { void handleImportBackup(); }}>Import Backup</Button>
          </div>
        ) : null}
      </Card>

      <Card as="section" className="recipe-page-card recipe-tool-card">
        <div className="recipe-section-heading">
          <div>
            <p className="eyebrow">Cookbook Search</p>
            <h2>Find a recipe</h2>
            <p>Search by name or ingredient, then narrow by category, tags, favorites, or rating.</p>
          </div>
          <Button type="button" onClick={() => setShowAdvancedFilters((value) => !value)}>{showAdvancedFilters ? "Hide Advanced" : "Advanced Filters"}</Button>
        </div>
        <form className="recipe-filter-form" onSubmit={(event) => { void handleFilter(event); }}>
          <div className="recipe-filter-grid">
            <FormField label="Search" className="recipe-form-field"><TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Spaghetti, cake, fajitas..." /></FormField>
            <FormField label="Ingredient" className="recipe-form-field"><TextInput value={ingredient} onChange={(event) => setIngredient(event.target.value)} placeholder="beef, flour, peppers..." /></FormField>
            {showAdvancedFilters ? (
              <>
                <FormField label="Category" className="recipe-form-field"><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Any category</option>{categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></FormField>
                <FormField label="Tag" className="recipe-form-field"><select value={tagId} onChange={(event) => setTagId(event.target.value)}><option value="">Any tag</option>{tags.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></FormField>
                <FormField label="Minimum Rating" className="recipe-form-field"><TextInput type="number" min="1" max="5" value={minRating} onChange={(event) => setMinRating(event.target.value)} /></FormField>
                <label className="recipe-checkbox-pill"><input type="checkbox" checked={favoriteOnly} onChange={(event) => setFavoriteOnly(event.target.checked)} /> Favorites only</label>
              </>
            ) : null}
          </div>
          <div className="recipe-filter-actions">
            <Button type="submit">Apply Filters</Button>
          </div>
        </form>
      </Card>

      {editing ? <Card as="article" className="recipe-page-card recipe-editor-card"><h2>Recipe Editor</h2><RecipeEditor payload={payload} setPayload={setPayload} categories={categories} tags={tags} availableRecipes={recipes} submitLabel="Save Recipe" onSubmit={(event) => { void handleSave(event); }} onCancel={() => setEditing(false)} /></Card> : null}

      <section className="recipe-card-grid">
        {recipes.map((recipe) => (
          <Card as="article" key={recipe.id} className="recipe-card">
            <div className="recipe-card-media">
              {recipe.photo_url !== null ? <img className="recipe-photo recipe-photo--card" src={recipe.photo_url} alt={`${recipe.title}`} loading="lazy" /> : <div className="recipe-photo-placeholder">Family Recipe</div>}
              {recipe.favorite ? <span className="recipe-favorite-badge" aria-label="Favorite recipe">★</span> : null}
            </div>
            <div className="recipe-card-body">
              <p className="eyebrow">Recipe</p>
              <h2>{recipe.title}</h2>
              <p className="recipe-card-description">{recipe.description || "No description yet."}</p>
              <div className="recipe-pill-row">{recipeMetaPills(recipe).map((pill) => <span key={pill} className="recipe-meta-pill">{pill}</span>)}</div>
              {recipeTaxonomy(recipe).length > 0 ? <div className="recipe-chip-row">{recipeTaxonomy(recipe).map((label) => <span key={label} className="recipe-chip">{label}</span>)}</div> : null}
              <Link className="jewel-button button-reset recipe-card-cta" to={`/recipes/${recipe.id}`}>View Recipe</Link>
            </div>
          </Card>
        ))}
      </section>
    </>
  );
}

export function RecipeDetailPage(): ReactElement {
  const navigate = useNavigate();
  const { recipeId } = useParams();
  const parsedRecipeId = Number(recipeId);
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [allRecipes, setAllRecipes] = useState<RecipeSummary[]>([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [tags, setTags] = useState<RecipeTag[]>([]);
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
  const [editing, setEditing] = useState(false);
  const [editPayload, setEditPayload] = useState<CreateRecipeRequest>(buildEmptyRecipePayload());
  const [cookingMode, setCookingMode] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingRecipe, setDeletingRecipe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function reloadRecipe(recipeIdToLoad: number): Promise<void> {
    const detail = await apiClient.getRecipe(recipeIdToLoad);
    setRecipe(detail);
    setEditPayload(payloadFromRecipe(detail));
  }

  useEffect(() => {
    async function loadRecipe(): Promise<void> {
      setError(null);
      if (!Number.isInteger(parsedRecipeId) || parsedRecipeId <= 0) { setError("Recipe not found."); return; }
      try {
        const detail = await apiClient.getRecipe(parsedRecipeId);
        setRecipe(detail);
        setEditPayload(payloadFromRecipe(detail));
        setScaled(null);
        setTargetServings(detail.servings !== null ? String(detail.servings) : "");
        setScaleMultiplier("1");
        const session = await apiClient.getCurrentSession();
        setCurrentUser(session.user);
        const [childRows, recipeRows, categoryRows, tagRows] = await Promise.all([
          apiClient.listChildren({ household_id: detail.household_id, active_only: true }),
          apiClient.listRecipes({ active_only: true }),
          apiClient.listRecipeCategories(),
          apiClient.listRecipeTags(),
        ]);
        setChildren(childRows);
        setAllRecipes(recipeRows.filter((row) => row.id !== detail.id));
        setCategories(categoryRows);
        setTags(tagRows);
        setFeedbackChildId(childRows[0]?.id !== undefined ? String(childRows[0].id) : "");
      } catch (loadError: unknown) { setError(errorText(loadError)); }
    }
    void loadRecipe();
  }, [parsedRecipeId]);

  async function handleServingScale(value: string): Promise<void> {
    setTargetServings(value);
    if (recipe === null) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    if (recipe.servings !== null && recipe.servings > 0) setScaleMultiplier(formatScaleInput(numeric / recipe.servings));
    setScaled(await apiClient.scaleRecipe(recipe.id, { targetServings: numeric }));
  }

  async function handleMultiplierScale(value: string): Promise<void> {
    setScaleMultiplier(value);
    if (recipe === null) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    if (recipe.servings !== null && recipe.servings > 0) setTargetServings(formatScaleInput(recipe.servings * numeric));
    setScaled(await apiClient.scaleRecipe(recipe.id, { scaleFactor: numeric }));
  }

  async function handleUpdateRecipe(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (recipe === null) return;
    setError(null);
    try {
      const ingredients = (editPayload.ingredients ?? []).filter((row) => row.item.trim().length > 0).map((row, index) => ({ ...row, position: index + 1 }));
      const validPositions = new Set(ingredients.map((row) => row.position));
      const steps = (editPayload.steps ?? []).filter((row) => row.instruction.trim().length > 0).map((row, index) => ({ ...row, position: index + 1, ingredient_position_refs: (row.ingredient_position_refs ?? []).filter((ref) => validPositions.has(ref)) }));
      const components = (editPayload.components ?? []).filter((row) => row.component_recipe_id > 0 && row.component_recipe_id !== recipe.id);
      const updated = await apiClient.updateRecipe(recipe.id, { ...editPayload, title: editPayload.title.trim(), ingredients, steps, components });
      setRecipe(updated);
      setEditPayload(payloadFromRecipe(updated));
      setEditing(false);
      setMessage(`Updated ${updated.title}.`);
    } catch (updateError: unknown) { setError(errorText(updateError)); }
  }

  async function handleAddVariant(): Promise<void> {
    if (recipe === null) return;
    const title = `${recipe.title} Variant`;
    setError(null);
    try { const variant = await apiClient.duplicateRecipe(recipe.id, { title, as_variant: true }); setMessage(`Created variant ${variant.title}.`); await reloadRecipe(recipe.id); } catch (variantError: unknown) { setError(errorText(variantError)); }
  }

  async function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (recipe === null || currentUser === null) return;
    const numericRating = feedbackRating === "" ? null : Number(feedbackRating);
    if (numericRating !== null && (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5)) return;
    setError(null);
    try {
      await apiClient.upsertRecipeFeedback(recipe.id, { reviewer_type: feedbackReviewerType, parent_user_id: feedbackReviewerType === "PARENT" ? currentUser.id : null, child_id: feedbackReviewerType === "CHILD" ? Number(feedbackChildId) : null, rating: numericRating, verdict: feedbackVerdict, notes: feedbackNotes });
      setMessage("Saved family feedback.");
      setFeedbackVerdict(""); setFeedbackNotes("");
      await reloadRecipe(recipe.id);
    } catch (feedbackError: unknown) { setError(errorText(feedbackError)); }
  }

  async function handleDeleteRecipe(): Promise<void> {
    if (recipe === null || deleteConfirmText !== recipe.title || deletingRecipe) return;
    setError(null); setDeletingRecipe(true);
    try { await apiClient.deleteRecipe(recipe.id); navigate("/recipes"); } catch (deleteError: unknown) { setError(errorText(deleteError)); setDeletingRecipe(false); }
  }

  function handleExportPdf(): void { window.print(); }

  const displayedIngredients = scaled?.ingredients ?? recipe?.ingredients ?? [];
  const displayedSteps = scaled?.steps ?? recipe?.steps ?? [];
  const currentStep = displayedSteps[currentStepIndex];
  const linkedCurrentIngredients = useMemo(() => {
    if (currentStep === undefined || recipe === null) return [];
    const refs = "ingredient_position_refs" in currentStep ? currentStep.ingredient_position_refs : [];
    return recipe.ingredients.filter((ingredient) => refs.includes(ingredient.position));
  }, [currentStep, recipe]);

  if (error !== null) return <Card as="section" className="recipe-detail-card"><Link to="/recipes">Back to Recipes</Link><InlineNotice variant="error">{error}</InlineNotice></Card>;
  if (recipe === null) return <Card as="section" className="recipe-detail-card"><p className="eyebrow">Recipe Organizer</p><h1>Loading Recipe</h1><p>Opening the recipe cooking page.</p></Card>;

  if (cookingMode) {
    return (
      <Card as="section" className="recipe-detail-card cooking-mode-card">
        <Button type="button" onClick={() => setCookingMode(false)}>Exit Cooking Mode</Button>
        <p className="eyebrow">Cooking Mode · Step {Math.min(currentStepIndex + 1, displayedSteps.length)} of {displayedSteps.length}</p>
        <h1>{recipe.title}</h1>
        <h2>{currentStep !== undefined ? displayStepInstruction(currentStep) : "No steps yet."}</h2>
        {linkedCurrentIngredients.length > 0 ? <p>Uses: {linkedCurrentIngredients.map(formatIngredientLine).join("; ")}</p> : null}
        <div className="recipe-print-actions cooking-step-actions"><Button type="button" disabled={currentStepIndex === 0} onClick={() => setCurrentStepIndex((value) => Math.max(0, value - 1))}>Previous Step</Button><Button type="button" disabled={currentStepIndex >= displayedSteps.length - 1} onClick={() => setCurrentStepIndex((value) => Math.min(displayedSteps.length - 1, value + 1))}>Next Step</Button></div>
      </Card>
    );
  }

  return (
    <Card as="section" className="recipe-detail-card">
      <Link to="/recipes">Back to Recipes</Link>
      {message !== null ? <InlineNotice variant="success">{message}</InlineNotice> : null}
      <div className="recipe-print-actions">
        <Button type="button" onClick={handleExportPdf}>Export PDF</Button>
        <Button type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Close Editor" : "Edit Recipe"}</Button>
        <Button type="button" onClick={() => setCookingMode(true)}>Cooking Mode</Button>
        <Button type="button" variant="danger" onClick={() => { setDeleteConfirmText(""); setDeleteModalOpen(true); }}>Delete Recipe</Button>
        <span>Export, edit, cook step-by-step, or delete with typed confirmation.</span>
      </div>
      {deleteModalOpen ? (
        <div className="recipe-delete-modal" role="dialog" aria-modal="true" aria-label="Delete recipe confirmation">
          <div className="glass-card">
            <h2>Delete {recipe.title}?</h2>
            <p>This permanently removes the recipe, ingredients, steps, variants, sub-recipes, and family feedback. Type the recipe title to confirm.</p>
            <FormField label="Type recipe title to delete"><TextInput value={deleteConfirmText} onChange={(event) => setDeleteConfirmText(event.target.value)} /></FormField>
            <div className="recipe-print-actions"><Button type="button" onClick={() => setDeleteModalOpen(false)}>Cancel</Button><Button type="button" variant="danger" disabled={deleteConfirmText !== recipe.title || deletingRecipe} onClick={() => { void handleDeleteRecipe(); }}>{deletingRecipe ? "Deleting..." : "Permanently Delete"}</Button></div>
          </div>
        </div>
      ) : null}
      {editing ? <Card as="article" className="recipe-editor-card"><h2>Edit Recipe</h2><RecipeEditor payload={editPayload} setPayload={setEditPayload} categories={categories} tags={tags} availableRecipes={allRecipes} submitLabel="Update Recipe" onSubmit={(event) => { void handleUpdateRecipe(event); }} onCancel={() => setEditing(false)} /></Card> : null}
      <p className="eyebrow">Recipe Cooking Page</p>
      <h1>{recipe.title}</h1>
      {recipe.photo_url !== null ? <img className="recipe-photo recipe-photo--hero" src={recipe.photo_url} alt={`${recipe.title}`} /> : null}
      {recipe.core_recipe !== null ? <p>Core recipe: <Link to={`/recipes/${recipe.core_recipe.id}`}>{recipe.core_recipe.title}</Link></p> : null}
      <p>{recipe.description}</p>
      {recipe.source_url !== null ? <p>Source: <a href={recipe.source_url}>{recipe.source_name || recipe.source_url}</a></p> : null}
      <p>{recipe.categories.map((row) => row.name).join(", ")}</p>
      <p>{recipe.tags.map((row) => row.name).join(", ")}</p>
      <p>{recipe.favorite ? "Favorite" : ""} {recipe.rating !== null ? `Rating ${recipe.rating}` : ""}</p>
      <p>{recipe.notes}</p>
      <p>Default servings: {recipe.servings !== null ? formatQuantity(recipe.servings) : "not set"}</p>
      <FormField label="Scaled Servings"><TextInput type="number" value={targetServings} onChange={(event) => { void handleServingScale(event.target.value); }} /></FormField>
      <FormField label="Scale Multiplier"><TextInput type="number" step="0.25" value={scaleMultiplier} onChange={(event) => { void handleMultiplierScale(event.target.value); }} /></FormField>
      <h2>Ingredients</h2><ul>{displayedIngredients.map((row) => <li key={row.id}><label><input type="checkbox" /> {formatIngredientLine(row)}</label></li>)}</ul>
      <h2>Steps</h2><ol>{displayedSteps.map((step) => <li key={step.id}>{displayStepInstruction(step)}</li>)}</ol>
      <h2>Recipe Variants</h2><p>Use variants for varieties like gluten-free, spicy, kid-friendly, or batch-size versions that stay attached to this core recipe.</p><Button type="button" onClick={() => { void handleAddVariant(); }}>Add Variant</Button>
      {recipe.variants.length > 0 ? <ul>{recipe.variants.map((row) => <li key={row.id}><Link to={`/recipes/${row.id}`}>{row.title}</Link></li>)}</ul> : <p>No variants yet.</p>}
      <h2>Sub-recipes</h2>{recipe.components.length > 0 ? <ul>{recipe.components.map((row) => <li key={row.component_recipe_id}><Link to={`/recipes/${row.component_recipe_id}`}>{row.component_recipe.title}</Link>{row.label ? ` · ${row.label}` : ""}</li>)}</ul> : <p>No sub-recipes attached yet. Use Edit Recipe to add sauces, doughs, marinades, or frostings.</p>}
      <h2>Family Feedback</h2><p>Average family rating: {recipe.feedback_summary.average_rating ?? "not rated"} ({recipe.feedback_summary.rating_count} ratings)</p>
      <form onSubmit={(event) => { void handleFeedbackSubmit(event); }}>
        <FormField label="Feedback For"><select value={feedbackReviewerType} onChange={(event) => setFeedbackReviewerType(event.target.value as "PARENT" | "CHILD")}><option value="PARENT">Parent</option><option value="CHILD">Child</option></select></FormField>
        {feedbackReviewerType === "CHILD" ? <FormField label="Child"><select value={feedbackChildId} onChange={(event) => setFeedbackChildId(event.target.value)}>{children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}</select></FormField> : null}
        <FormField label="Family Rating"><TextInput type="number" min="1" max="5" value={feedbackRating} onChange={(event) => setFeedbackRating(event.target.value)} /></FormField>
        <FormField label="Verdict"><TextInput value={feedbackVerdict} onChange={(event) => setFeedbackVerdict(event.target.value)} placeholder="Loved it, okay, too spicy..." /></FormField>
        <FormField label="Feedback Notes"><TextInput value={feedbackNotes} onChange={(event) => setFeedbackNotes(event.target.value)} /></FormField>
        <Button type="submit">Save Feedback</Button>
      </form>
      {recipe.feedback.length > 0 ? <ul>{recipe.feedback.map((row) => <li key={row.id}>{row.reviewer_name}: {row.rating !== null ? `${row.rating}/5` : "not rated"} {row.verdict} {row.notes}</li>)}</ul> : <p>No family feedback yet.</p>}
      <article className="recipe-pdf-sheet" aria-label={`${recipe.title} PDF export`} aria-hidden="true"><header><p className="recipe-pdf-kicker">Family Manager Recipe</p><h1>{recipe.title}</h1><p className="recipe-pdf-meta">{recipe.servings !== null ? `Serves ${formatQuantity(recipe.servings)}` : "Servings not set"}{recipe.categories.length > 0 ? ` · ${recipe.categories.map((row) => row.name).join(", ")}` : ""}{recipe.tags.length > 0 ? ` · ${recipe.tags.map((row) => row.name).join(", ")}` : ""}</p>{recipe.description.trim().length > 0 ? <p>{recipe.description}</p> : null}{recipe.source_url !== null ? <p className="recipe-pdf-source">Source: {recipe.source_name || recipe.source_url}</p> : null}</header><section className="recipe-pdf-grid"><div><h2>Ingredients</h2><ul>{displayedIngredients.map((row) => <li key={row.id}>{formatIngredientLine(row)}</li>)}</ul></div><div><h2>Steps</h2><ol>{displayedSteps.map((step) => <li key={step.id}>{displayStepInstruction(step)}</li>)}</ol></div></section>{recipe.notes.trim().length > 0 ? <p className="recipe-pdf-notes"><strong>Notes:</strong> {recipe.notes}</p> : null}</article>
    </Card>
  );
}
