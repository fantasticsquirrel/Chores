import type { FormEvent, ReactElement } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

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
import { Button, Card, InlineNotice } from "../ui";

export function RecipeOrganizerPage(): ReactElement {
  const navigate = useNavigate();
  const organizer = useRecipeOrganizer();

  async function handleSave(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const saved = await organizer.createRecipe();
    if (saved !== null) {
      navigate(`/recipes/${saved.id}`);
    }
  }

  async function handleImportUrl(): Promise<void> {
    const imported = await organizer.importRecipeFromUrl();
    if (imported !== null) {
      navigate(`/recipes/${imported.id}`);
    }
  }

  return (
    <>
      <Card as="section" className="recipe-page-card recipe-hero-card">
        <div>
          <p className="eyebrow">Household Cookbook</p>
          <h1>Recipe Organizer</h1>
          <p>
            Build a family cookbook with import, tags, variants, sub-recipes,
            backups, and cooking-mode scaling.
          </p>
          <div
            className="recipe-stat-strip"
            aria-label="Recipe organizer summary"
          >
            <span>{organizer.recipes.length} recipes</span>
            <span>{organizer.categories.length} categories</span>
            <span>{organizer.tags.length} tags</span>
          </div>
        </div>
        <div className="recipe-hero-actions">
          <Button type="button" onClick={() => organizer.setEditing(true)}>
            New Recipe
          </Button>
          <Button
            type="button"
            onClick={() =>
              organizer.setShowBackupTools((value) => !value)
            }
          >
            {organizer.showBackupTools ? "Hide Backup" : "Backup & Restore"}
          </Button>
        </div>
      </Card>

      {organizer.error !== null ? (
        <InlineNotice variant="error">{organizer.error}</InlineNotice>
      ) : null}
      {organizer.message !== null ? (
        <InlineNotice variant="success">{organizer.message}</InlineNotice>
      ) : null}

      <RecipeImportPanel
        backupJson={organizer.backupJson}
        importUrl={organizer.importUrl}
        onExportBackup={organizer.exportBackup}
        onImportBackup={organizer.importBackup}
        onImportUrl={handleImportUrl}
        setBackupJson={organizer.setBackupJson}
        setImportUrl={organizer.setImportUrl}
        showBackupTools={organizer.showBackupTools}
      />

      <RecipeFilterPanel
        categories={organizer.categories}
        categoryId={organizer.categoryId}
        favoriteOnly={organizer.favoriteOnly}
        ingredient={organizer.ingredient}
        minRating={organizer.minRating}
        onFilter={organizer.refresh}
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

      {organizer.editing ? (
        <Card as="article" className="recipe-page-card recipe-editor-card">
          <h2>Recipe Editor</h2>
          <RecipeEditor
            payload={organizer.payload}
            setPayload={organizer.setPayload}
            categories={organizer.categories}
            tags={organizer.tags}
            availableRecipes={organizer.recipes}
            submitLabel="Save Recipe"
            onSubmit={(event) => void handleSave(event)}
            onCancel={() => organizer.setEditing(false)}
          />
        </Card>
      ) : null}

      <RecipeCardGrid recipes={organizer.recipes} />
    </>
  );
}

export function RecipeDetailPage(): ReactElement {
  const navigate = useNavigate();
  const { recipeId } = useParams();
  const detail = useRecipeDetail(Number(recipeId));

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
        setCookingMode={detail.setCookingMode}
        setDeleteConfirmText={detail.setDeleteConfirmText}
        setDeleteModalOpen={detail.setDeleteModalOpen}
        setEditing={detail.setEditing}
        setEditPayload={detail.setEditPayload}
        tags={detail.tags}
      />
      <p className="eyebrow">Recipe Cooking Page</p>
      <h1>{detail.recipe.title}</h1>
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
        {detail.recipe.rating !== null
          ? `Rating ${detail.recipe.rating}`
          : ""}
      </p>
      <p>{detail.recipe.notes}</p>
      <p>
        Default servings:{" "}
        {detail.recipe.servings !== null
          ? formatQuantity(detail.recipe.servings)
          : "not set"}
      </p>
      <RecipeInstructions
        displayedIngredients={detail.displayedIngredients}
        displayedSteps={detail.displayedSteps}
        onScaleMultiplier={detail.scaleToMultiplier}
        onScaleServings={detail.scaleToServings}
        scaleMultiplier={detail.scaleMultiplier}
        targetServings={detail.targetServings}
      />
      <RecipeRelations
        onAddVariant={detail.addVariant}
        recipe={detail.recipe}
      />
      <RecipeFeedbackPanel
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
      <RecipePrintSheet
        displayedIngredients={detail.displayedIngredients}
        displayedSteps={detail.displayedSteps}
        recipe={detail.recipe}
      />
    </Card>
  );
}
