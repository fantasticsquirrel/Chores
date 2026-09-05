import type { FormEvent, ReactElement } from "react";

import type {
  CreateRecipeRequest,
  RecipeCategory,
  RecipeDetail,
  RecipeSummary,
  RecipeTag,
} from "../../../api";
import { Button, Card, FormField, TextInput } from "../../../ui";
import { RecipeEditor } from "./RecipeEditor";

type RecipeDetailActionsProps = {
  allRecipes: RecipeSummary[];
  canEditRecipe: boolean;
  categories: RecipeCategory[];
  deleteConfirmText: string;
  deleteModalOpen: boolean;
  deletingRecipe: boolean;
  editing: boolean;
  editPayload: CreateRecipeRequest;
  onDelete: () => Promise<void>;
  onUpdate: () => Promise<void>;
  recipe: RecipeDetail;
  setCookingMode: (value: boolean) => void;
  setDeleteConfirmText: (value: string) => void;
  setDeleteModalOpen: (value: boolean) => void;
  setEditing: (value: boolean | ((previous: boolean) => boolean)) => void;
  setEditPayload: (
    value:
      | CreateRecipeRequest
      | ((previous: CreateRecipeRequest) => CreateRecipeRequest),
  ) => void;
  tags: RecipeTag[];
};

export function RecipeDetailActions({
  allRecipes,
  canEditRecipe,
  categories,
  deleteConfirmText,
  deleteModalOpen,
  deletingRecipe,
  editing,
  editPayload,
  onDelete,
  onUpdate,
  recipe,
  setCookingMode,
  setDeleteConfirmText,
  setDeleteModalOpen,
  setEditing,
  setEditPayload,
  tags,
}: RecipeDetailActionsProps): ReactElement {
  function handleUpdate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void onUpdate();
  }

  return (
    <>
      <div className="recipe-print-actions">
        <Button type="button" onClick={() => window.print()}>
          Export PDF
        </Button>
        {canEditRecipe ? (
          <Button type="button" onClick={() => setEditing((value) => !value)}>
            {editing ? "Close Editor" : "Edit Recipe"}
          </Button>
        ) : null}
        <Button type="button" onClick={() => setCookingMode(true)}>
          Cooking Mode
        </Button>
        {canEditRecipe ? (
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setDeleteConfirmText("");
              setDeleteModalOpen(true);
            }}
          >
            Delete Recipe
          </Button>
        ) : null}
        <span>
          {canEditRecipe
            ? "Export, edit, cook step-by-step, or delete with typed confirmation."
            : "Export or cook step-by-step. Only the creator or a household admin can edit this recipe."}
        </span>
      </div>
      {deleteModalOpen && canEditRecipe ? (
        <div
          className="recipe-delete-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Delete recipe confirmation"
        >
          <div className="glass-card">
            <h2>Delete {recipe.title}?</h2>
            <p>
              This permanently removes the recipe, ingredients, steps,
              variants, sub-recipes, and family feedback. Type the recipe title
              to confirm.
            </p>
            <FormField label="Type recipe title to delete">
              <TextInput
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
              />
            </FormField>
            <div className="recipe-print-actions">
              <Button type="button" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={
                  deleteConfirmText !== recipe.title || deletingRecipe
                }
                onClick={() => void onDelete()}
              >
                {deletingRecipe ? "Deleting..." : "Permanently Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {editing && canEditRecipe ? (
        <Card as="article" className="recipe-editor-card">
          <h2>Edit Recipe</h2>
          <RecipeEditor
            payload={editPayload}
            setPayload={setEditPayload}
            categories={categories}
            tags={tags}
            availableRecipes={allRecipes}
            submitLabel="Update Recipe"
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
          />
        </Card>
      ) : null}
    </>
  );
}
