import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";

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
} from "../../../api";
import { formatApiError } from "../../../lib/errors";
import {
  buildEmptyRecipePayload,
  buildRecipePayloadForUpdate,
  formatScaleInput,
  payloadFromRecipe,
} from "../lib/payloadMapping";

export type FeedbackReviewerType = "PARENT" | "CHILD";
export type DisplayedRecipeIngredient =
  | RecipeDetail["ingredients"][number]
  | RecipeScaleResponse["ingredients"][number];
export type DisplayedRecipeStep =
  | RecipeDetail["steps"][number]
  | RecipeScaleResponse["steps"][number];

export type UseRecipeDetailResult = {
  addVariant: () => Promise<void>;
  allRecipes: RecipeSummary[];
  canEditRecipe: boolean;
  categories: RecipeCategory[];
  children: Child[];
  cookingMode: boolean;
  currentStep: DisplayedRecipeStep | undefined;
  currentStepIndex: number;
  deleteConfirmText: string;
  deleteModalOpen: boolean;
  deleteRecipe: () => Promise<boolean>;
  deletingRecipe: boolean;
  displayedIngredients: DisplayedRecipeIngredient[];
  displayedSteps: DisplayedRecipeStep[];
  editPayload: CreateRecipeRequest;
  editing: boolean;
  error: string | null;
  feedbackChildId: string;
  feedbackNotes: string;
  feedbackRating: string;
  feedbackReviewerType: FeedbackReviewerType;
  feedbackVerdict: string;
  linkedCurrentIngredients: RecipeDetail["ingredients"];
  message: string | null;
  recipe: RecipeDetail | null;
  saveFeedback: () => Promise<void>;
  scaleMultiplier: string;
  scaleToMultiplier: (value: string) => Promise<void>;
  scaleToServings: (value: string) => Promise<void>;
  setCookingMode: (value: boolean) => void;
  setCurrentStepIndex: Dispatch<SetStateAction<number>>;
  setDeleteConfirmText: (value: string) => void;
  setDeleteModalOpen: (value: boolean) => void;
  setEditing: Dispatch<SetStateAction<boolean>>;
  setEditPayload: Dispatch<SetStateAction<CreateRecipeRequest>>;
  setFeedbackChildId: (value: string) => void;
  setFeedbackNotes: (value: string) => void;
  setFeedbackRating: (value: string) => void;
  setFeedbackReviewerType: (value: FeedbackReviewerType) => void;
  setFeedbackVerdict: (value: string) => void;
  tags: RecipeTag[];
  targetServings: string;
  updateRecipe: () => Promise<void>;
};

export function useRecipeDetail(recipeId: number): UseRecipeDetailResult {
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [allRecipes, setAllRecipes] = useState<RecipeSummary[]>([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [scaled, setScaled] = useState<RecipeScaleResponse | null>(null);
  const [targetServings, setTargetServings] = useState("8");
  const [scaleMultiplier, setScaleMultiplier] = useState("1");
  const [children, setChildren] = useState<Child[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [feedbackReviewerType, setFeedbackReviewerType] =
    useState<FeedbackReviewerType>("PARENT");
  const [feedbackChildId, setFeedbackChildId] = useState("");
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackVerdict, setFeedbackVerdict] = useState("");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [editPayload, setEditPayload] = useState<CreateRecipeRequest>(
    buildEmptyRecipePayload(),
  );
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
      if (!Number.isInteger(recipeId) || recipeId <= 0) {
        setError("Recipe not found.");
        return;
      }

      try {
        const [detail, session] = await Promise.all([
          apiClient.getRecipe(recipeId),
          apiClient.getCurrentSession(),
        ]);
        setRecipe(detail);
        setCurrentUser(session.user);
        setEditPayload(payloadFromRecipe(detail));
        setScaled(null);
        setTargetServings(
          detail.servings !== null ? String(detail.servings) : "",
        );
        setScaleMultiplier("1");
        const [childRows, recipeRows, categoryRows, tagRows] =
          await Promise.all([
            apiClient.listChildren({
              household_id: detail.household_id,
              active_only: true,
            }),
            apiClient.listRecipes({ active_only: true }),
            apiClient.listRecipeCategories(),
            apiClient.listRecipeTags(),
          ]);
        setChildren(childRows);
        setAllRecipes(recipeRows.filter((row) => row.id !== detail.id));
        setCategories(categoryRows);
        setTags(tagRows);
        setFeedbackChildId(
          childRows[0]?.id !== undefined ? String(childRows[0].id) : "",
        );
      } catch (loadError: unknown) {
        setError(formatApiError(loadError));
      }
    }

    void loadRecipe();
  }, [recipeId]);

  async function scaleToServings(value: string): Promise<void> {
    setTargetServings(value);
    if (recipe === null) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    if (recipe.servings !== null && recipe.servings > 0) {
      setScaleMultiplier(formatScaleInput(numeric / recipe.servings));
    }
    setScaled(
      await apiClient.scaleRecipe(recipe.id, { targetServings: numeric }),
    );
  }

  async function scaleToMultiplier(value: string): Promise<void> {
    setScaleMultiplier(value);
    if (recipe === null) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    if (recipe.servings !== null && recipe.servings > 0) {
      setTargetServings(formatScaleInput(recipe.servings * numeric));
    }
    setScaled(await apiClient.scaleRecipe(recipe.id, { scaleFactor: numeric }));
  }

  async function updateRecipe(): Promise<void> {
    if (recipe === null) return;
    setError(null);
    try {
      const updated = await apiClient.updateRecipe(
        recipe.id,
        buildRecipePayloadForUpdate(editPayload, recipe.id),
      );
      setRecipe(updated);
      setEditPayload(payloadFromRecipe(updated));
      setEditing(false);
      setMessage(`Updated ${updated.title}.`);
    } catch (updateError: unknown) {
      setError(formatApiError(updateError));
    }
  }

  async function addVariant(): Promise<void> {
    if (recipe === null) return;
    const title = `${recipe.title} Variant`;
    setError(null);
    try {
      const variant = await apiClient.duplicateRecipe(recipe.id, {
        title,
        as_variant: true,
      });
      setMessage(`Created variant ${variant.title}.`);
      await reloadRecipe(recipe.id);
    } catch (variantError: unknown) {
      setError(formatApiError(variantError));
    }
  }

  async function saveFeedback(): Promise<void> {
    if (recipe === null || currentUser === null) return;
    const numericRating =
      feedbackRating === "" ? null : Number(feedbackRating);
    if (
      numericRating !== null &&
      (!Number.isFinite(numericRating) ||
        numericRating < 1 ||
        numericRating > 5)
    ) {
      return;
    }
    setError(null);
    try {
      await apiClient.upsertRecipeFeedback(recipe.id, {
        reviewer_type: feedbackReviewerType,
        parent_user_id:
          feedbackReviewerType === "PARENT" ? currentUser.id : null,
        child_id:
          feedbackReviewerType === "CHILD" ? Number(feedbackChildId) : null,
        rating: numericRating,
        verdict: feedbackVerdict,
        notes: feedbackNotes,
      });
      setMessage("Saved family feedback.");
      setFeedbackVerdict("");
      setFeedbackNotes("");
      await reloadRecipe(recipe.id);
    } catch (feedbackError: unknown) {
      setError(formatApiError(feedbackError));
    }
  }

  async function deleteRecipe(): Promise<boolean> {
    if (
      recipe === null ||
      deleteConfirmText !== recipe.title ||
      deletingRecipe
    ) {
      return false;
    }
    setError(null);
    setDeletingRecipe(true);
    try {
      await apiClient.deleteRecipe(recipe.id);
      return true;
    } catch (deleteError: unknown) {
      setError(formatApiError(deleteError));
      setDeletingRecipe(false);
      return false;
    }
  }

  const displayedIngredients: DisplayedRecipeIngredient[] =
    scaled?.ingredients ?? recipe?.ingredients ?? [];
  const displayedSteps: DisplayedRecipeStep[] =
    scaled?.steps ?? recipe?.steps ?? [];
  const currentStep = displayedSteps[currentStepIndex];
  const canEditRecipe =
    currentUser !== null &&
    (currentUser.id === recipe?.owner_user_id ||
      currentUser.role === "PARENT_ADMIN");
  const linkedCurrentIngredients = useMemo(() => {
    if (currentStep === undefined || recipe === null) return [];
    const refs =
      "ingredient_position_refs" in currentStep
        ? currentStep.ingredient_position_refs
        : [];
    return recipe.ingredients.filter((ingredient) =>
      refs.includes(ingredient.position),
    );
  }, [currentStep, recipe]);

  return {
    addVariant,
    allRecipes,
    canEditRecipe,
    categories,
    children,
    cookingMode,
    currentStep,
    currentStepIndex,
    deleteConfirmText,
    deleteModalOpen,
    deleteRecipe,
    deletingRecipe,
    displayedIngredients,
    displayedSteps,
    editPayload,
    editing,
    error,
    feedbackChildId,
    feedbackNotes,
    feedbackRating,
    feedbackReviewerType,
    feedbackVerdict,
    linkedCurrentIngredients,
    message,
    recipe,
    saveFeedback,
    scaleMultiplier,
    scaleToMultiplier,
    scaleToServings,
    setCookingMode,
    setCurrentStepIndex,
    setDeleteConfirmText,
    setDeleteModalOpen,
    setEditing,
    setEditPayload,
    setFeedbackChildId,
    setFeedbackNotes,
    setFeedbackRating,
    setFeedbackReviewerType,
    setFeedbackVerdict,
    tags,
    targetServings,
    updateRecipe,
  };
}
