import { useEffect, useRef, type FormEvent, type ReactElement } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { RecipeTaskDialog } from "../features/recipes/components/RecipeTaskDialog";
import "../features/recipes/recipes-browse.css";
import { RecipeCardGrid } from "../features/recipes/components/RecipeCardGrid";
import { RecipeCookingMode } from "../features/recipes/components/RecipeCookingMode";
import { RecipeDetailActions } from "../features/recipes/components/RecipeDetailActions";
import { RecipeEditor } from "../features/recipes/components/RecipeEditor";
import { RecipeFeedbackPanel } from "../features/recipes/components/RecipeFeedbackPanel";
import { RecipeFilterPanel } from "../features/recipes/components/RecipeFilterPanel";
import { RecipeImportPanel } from "../features/recipes/components/RecipeImportPanel";
import { RecipeInstructions } from "../features/recipes/components/RecipeInstructions";
import { RecipePrintSheet } from "../features/recipes/components/RecipePrintSheet";
import { RecipeRelations } from "../features/recipes/components/RecipeRelations";
import { useRecipeDetail } from "../features/recipes/hooks/useRecipeDetail";
import { useRecipeOrganizer } from "../features/recipes/hooks/useRecipeOrganizer";
import { formatQuantity } from "../features/recipes/lib/scaling";
import { useAuth } from "../auth/useAuth";
import { Button, Card, InlineNotice } from "../ui";

export function RecipeOrganizerPage(): ReactElement {
  const navigate = useNavigate();
  const { user, manageableModuleKeys } = useAuth();
  const canManage =
    user !== null &&
    user.role !== "CHILD" &&
    manageableModuleKeys.includes("recipes");
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const task = params.get("recipeTask");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const workflowKey = `${user?.household_id}:${user?.id}:${canManage}:${task}`;
  const workflow = useRef({ key: workflowKey, generation: 0 });
  if (workflow.current.key !== workflowKey)
    workflow.current = {
      key: workflowKey,
      generation: workflow.current.generation + 1,
    };
  const organizer = useRecipeOrganizer(
    `${user?.household_id}:${user?.id}:${task ?? "browse"}:${workflow.current.generation}`,
    canManage,
  );
  function openTask(next: "new" | "import" | "backup") {
    const search = new URLSearchParams(params);
    search.set("recipeTask", next);
    setParams(search, { state: { recipeTask: true } });
  }
  function closeTask() {
    if (location.state?.recipeTask === true) navigate(-1);
    else {
      const search = new URLSearchParams(params);
      search.delete("recipeTask");
      setParams(search, { replace: true });
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const generation = workflow.current.generation;
    const saved = await organizer.createRecipe();
    if (
      saved !== null &&
      active.current &&
      generation === workflow.current.generation
    ) {
      navigate(`/recipes/${saved.id}`);
    }
  }

  async function handleImportUrl(): Promise<void> {
    const generation = workflow.current.generation;
    const imported = await organizer.importRecipeFromUrl();
    if (
      imported !== null &&
      active.current &&
      generation === workflow.current.generation
    ) {
      navigate(`/recipes/${imported.id}`);
    }
  }

  return (
    <>
      <Card as="section" className="recipe-page-card recipe-browse-header">
        <div>
          <p className="eyebrow">Household Cookbook</p>
          <h1>Recipe Organizer</h1>
        </div>
        {canManage && (
          <div className="recipe-hero-actions">
            <Button type="button" onClick={() => openTask("new")}>
              New Recipe
            </Button>
            <Button
              type="button"
              className="recipe-secondary"
              onClick={() => openTask("import")}
            >
              Import Recipe
            </Button>
          </div>
        )}
      </Card>
      {organizer.error !== null && (
        <InlineNotice variant="error">
          {organizer.error}{" "}
          <Button onClick={() => void organizer.refresh()}>
            Retry recipes
          </Button>
        </InlineNotice>
      )}
      {organizer.message !== null && (
        <InlineNotice variant="success">{organizer.message}</InlineNotice>
      )}
      {organizer.taxonomyError !== null && (
        <InlineNotice variant="error">
          {organizer.taxonomyError}{" "}
          <Button onClick={() => void organizer.retryTaxonomy()}>
            Retry categories and tags
          </Button>
        </InlineNotice>
      )}

      <RecipeFilterPanel
        categories={organizer.categories}
        categoryId={organizer.categoryId}
        favoriteOnly={organizer.favoriteOnly}
        ingredient={organizer.ingredient}
        minRating={organizer.minRating}
        onFilter={organizer.refresh}
        onReset={organizer.resetFilters}
        loading={organizer.loading}
        query={organizer.query}
        setCategoryId={organizer.setCategoryId}
        setFavoriteOnly={organizer.setFavoriteOnly}
        setIngredient={organizer.setIngredient}
        setMinRating={organizer.setMinRating}
        setQuery={organizer.setQuery}
        setTagId={organizer.setTagId}
        showAdvancedFilters={organizer.showAdvancedFilters}
        tagId={organizer.tagId}
        tags={organizer.tags}
        toggleAdvancedFilters={() =>
          organizer.setShowAdvancedFilters((value) => !value)
        }
      />

      {organizer.loading && (
        <p role="status">
          {organizer.loaded ? "Updating recipes…" : "Loading your cookbook…"}
        </p>
      )}
      {organizer.loaded &&
        !organizer.loading &&
        !organizer.error &&
        !organizer.recipes.length && (
          <Card as="section" className="recipe-page-card">
            <h2>
              {organizer.hasAppliedFilters
                ? "No recipes match"
                : "Your cookbook is empty"}
            </h2>
            <p>
              {organizer.hasAppliedFilters
                ? "Try another search or clear filters to browse your cookbook."
                : canManage
                  ? "Add a family recipe or import one from a recipe website to get started."
                  : "Ask a parent with management access to add a family recipe."}
            </p>
            {organizer.hasAppliedFilters && (
              <Button onClick={() => void organizer.resetFilters()}>
                Clear filters
              </Button>
            )}
          </Card>
        )}
      <RecipeCardGrid recipes={organizer.recipes} />
      <div>
        <Button
          type="button"
          className="recipe-secondary"
          onClick={() => openTask("backup")}
        >
          Backup & Restore
        </Button>
      </div>
      {canManage && task === "new" && (
        <RecipeTaskDialog title="Recipe Editor" onClose={closeTask}>
          {organizer.mutationError && (
            <InlineNotice variant="error">
              {organizer.mutationError}
            </InlineNotice>
          )}
          {organizer.saving && (
            <p role="status">
              Saving recipe… You can keep browsing; another save will be
              available when this one finishes.
            </p>
          )}
          <RecipeEditor
            payload={organizer.payload}
            setPayload={organizer.setPayload}
            categories={organizer.categories}
            tags={organizer.tags}
            availableRecipes={organizer.recipes}
            busy={organizer.saving}
            submitLabel="Save Recipe"
            onSubmit={(event) => void handleSave(event)}
            onCancel={closeTask}
          />
        </RecipeTaskDialog>
      )}
      {((canManage && task === "import") || task === "backup") && (
        <RecipeTaskDialog
          title={task === "backup" ? "Backup & Restore" : "Import Recipe"}
          onClose={closeTask}
        >
          {organizer.mutationError && (
            <InlineNotice variant="error">
              {organizer.mutationError}
            </InlineNotice>
          )}
          {organizer.saving && (
            <p role="status">
              Saving recipe… You can keep browsing; another save will be
              available when this one finishes.
            </p>
          )}
          <RecipeImportPanel
            busy={organizer.saving}
            canManage={canManage}
            backupJson={organizer.backupJson}
            importUrl={organizer.importUrl}
            onExportBackup={organizer.exportBackup}
            onImportBackup={organizer.importBackup}
            onImportUrl={handleImportUrl}
            setBackupJson={organizer.setBackupJson}
            setImportUrl={organizer.setImportUrl}
            showBackupTools={task === "backup"}
          />
        </RecipeTaskDialog>
      )}
    </>
  );
}

export function RecipeDetailPage(): ReactElement {
  const navigate = useNavigate();
  const { recipeId } = useParams();
  const { user, manageableModuleKeys, moduleKeys } = useAuth();
  const canManage =
    user !== null &&
    user.role !== "CHILD" &&
    manageableModuleKeys.includes("recipes");
  const detail = useRecipeDetail(Number(recipeId), {
    canManage,
    canReadChildren: moduleKeys.includes("chores"),
    identity: `${user?.household_id}:${user?.id}`,
  });

  async function handleDeleteRecipe(): Promise<void> {
    const deleted = await detail.deleteRecipe();
    if (deleted) {
      navigate("/recipes");
    }
  }

  if (detail.error !== null) {
    return (
      <Card as="section" className="recipe-detail-card">
        <Link to="/recipes">Back to Recipes</Link>
        <InlineNotice variant="error">{detail.error}</InlineNotice>
      </Card>
    );
  }
  if (detail.recipe === null) {
    return (
      <Card as="section" className="recipe-detail-card">
        <p className="eyebrow">Recipe Organizer</p>
        <h1>Loading Recipe</h1>
        <p>Opening the recipe cooking page.</p>
      </Card>
    );
  }

  if (detail.cookingMode) {
    return (
      <RecipeCookingMode
        currentStep={detail.currentStep}
        currentStepIndex={detail.currentStepIndex}
        displayedSteps={detail.displayedSteps}
        linkedCurrentIngredients={detail.linkedCurrentIngredients}
        recipe={detail.recipe}
        setCookingMode={detail.setCookingMode}
        setCurrentStepIndex={detail.setCurrentStepIndex}
      />
    );
  }

  return (
    <Card as="section" className="recipe-detail-card">
      <Link to="/recipes">Back to Recipes</Link>
      {detail.message !== null ? (
        <InlineNotice variant="success">{detail.message}</InlineNotice>
      ) : null}
      <p className="eyebrow">Recipe Cooking Page</p>
      <h1>{detail.recipe.title}</h1>
      <div className="recipe-cooking-actions">
        <span>
          Servings: {detail.appliedServings || "not set"} ·{" "}
          {detail.appliedMultiplier}×
        </span>
        <Button
          type="button"
          disabled={detail.scaling || !detail.displayedSteps.length}
          onClick={() => detail.setCookingMode(true)}
        >
          Start Cooking
        </Button>
        <Button
          type="button"
          className="recipe-secondary"
          disabled={detail.scaling}
          onClick={() => window.print()}
        >
          Export PDF
        </Button>
      </div>
      {detail.scaling && <p role="status">Applying scale…</p>}
      {detail.scaleError && (
        <InlineNotice variant="error">{detail.scaleError}</InlineNotice>
      )}
      <RecipeInstructions
        displayedIngredients={detail.displayedIngredients}
        displayedSteps={detail.displayedSteps}
        onScaleMultiplier={detail.scaleToMultiplier}
        onScaleServings={detail.scaleToServings}
        scaleMultiplier={detail.scaleMultiplier}
        targetServings={detail.targetServings}
      />
      <p>Added by {detail.recipe.creator_email ?? "a family member"}.</p>
      {detail.recipe.photo_url !== null ? (
        <img
          className="recipe-photo recipe-photo--hero"
          src={detail.recipe.photo_url}
          alt={`${detail.recipe.title}`}
        />
      ) : null}
      {detail.recipe.core_recipe !== null ? (
        <p>
          Core recipe:{" "}
          <Link to={`/recipes/${detail.recipe.core_recipe.id}`}>
            {detail.recipe.core_recipe.title}
          </Link>
        </p>
      ) : null}
      <p>{detail.recipe.description}</p>
      {detail.recipe.source_url !== null ? (
        <p>
          Source:{" "}
          <a href={detail.recipe.source_url}>
            {detail.recipe.source_name || detail.recipe.source_url}
          </a>
        </p>
      ) : null}
      <p>{detail.recipe.categories.map((row) => row.name).join(", ")}</p>
      <p>{detail.recipe.tags.map((row) => row.name).join(", ")}</p>
      <p>
        {detail.recipe.favorite ? "Favorite" : ""}{" "}
        {detail.recipe.rating !== null ? `Rating ${detail.recipe.rating}` : ""}
      </p>
      <p>{detail.recipe.notes}</p>
      <p>
        Default servings:{" "}
        {detail.recipe.servings !== null
          ? formatQuantity(detail.recipe.servings)
          : "not set"}
      </p>
      <details className="recipe-tools">
        <summary>Recipe tools</summary>
        <RecipeDetailActions
          allRecipes={detail.allRecipes}
          canEditRecipe={detail.canEditRecipe}
          categories={detail.categories}
          deleteConfirmText={detail.deleteConfirmText}
          deleteModalOpen={detail.deleteModalOpen}
          deletingRecipe={detail.deletingRecipe}
          editing={detail.editing}
          editPayload={detail.editPayload}
          onDelete={handleDeleteRecipe}
          onUpdate={detail.updateRecipe}
          recipe={detail.recipe}
          setDeleteConfirmText={detail.setDeleteConfirmText}
          setDeleteModalOpen={detail.setDeleteModalOpen}
          setEditing={detail.setEditing}
          setEditPayload={detail.setEditPayload}
          tags={detail.tags}
        />
        <RecipeRelations
          canManage={canManage}
          onAddVariant={detail.addVariant}
          recipe={detail.recipe}
        />
        <RecipeFeedbackPanel
          canManage={canManage}
          childId={detail.feedbackChildId}
          children={detail.children}
          notes={detail.feedbackNotes}
          onSave={detail.saveFeedback}
          rating={detail.feedbackRating}
          recipe={detail.recipe}
          reviewerType={detail.feedbackReviewerType}
          setChildId={detail.setFeedbackChildId}
          setNotes={detail.setFeedbackNotes}
          setRating={detail.setFeedbackRating}
          setReviewerType={detail.setFeedbackReviewerType}
          setVerdict={detail.setFeedbackVerdict}
          verdict={detail.feedbackVerdict}
        />
      </details>
      <RecipePrintSheet
        displayedIngredients={detail.displayedIngredients}
        displayedSteps={detail.displayedSteps}
        recipe={detail.recipe}
        targetServings={detail.appliedServings}
        scaleMultiplier={detail.appliedMultiplier}
      />
    </Card>
  );
}
