import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  appliedServings: string;
  appliedMultiplier: string;
  scaling: boolean;
  scaleError: string | null;
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

export function useRecipeDetail(
  recipeId: number,
  {
    canManage = true,
    canReadChildren = true,
    identity = "",
  }: { canManage?: boolean; canReadChildren?: boolean; identity?: string } = {},
): UseRecipeDetailResult {
  const mutationEpoch = useRef(0);
  const liveAccess = useRef({ canManage, identity });
  liveAccess.current = { canManage, identity };
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [allRecipes, setAllRecipes] = useState<RecipeSummary[]>([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const scaleRequest = useRef(0);
  const currentRecipeId = useRef(recipeId);
  currentRecipeId.current = recipeId;
  const [scaling, setScaling] = useState(false);
  const [scaleError, setScaleError] = useState<string | null>(null);
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
    const ticket = mutationEpoch.current;
    const detail = await apiClient.getRecipe(recipeIdToLoad);
    if (
      ticket !== mutationEpoch.current ||
      currentRecipeId.current !== recipeIdToLoad ||
      liveAccess.current.identity !== identity
    )
      return;
    setRecipe(detail);
    setEditPayload(payloadFromRecipe(detail));
  }

  useEffect(() => {
    let active = true;
    const scaleGeneration = scaleRequest;
    const mutationGeneration = mutationEpoch;
    mutationGeneration.current++;
    scaleGeneration.current++;
    setScaling(false);
    setScaleError(null);
    setScaled(null);
    setCookingMode(false);
    setCurrentStepIndex(0);
    setEditing(false);
    setDeleteModalOpen(false);
    setRecipe(null);
    setCurrentUser(null);
    setMessage(null);
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
        if (!active) return;
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
            canManage && canReadChildren
              ? apiClient.listChildren({
                  household_id: detail.household_id,
                  active_only: true,
                })
              : Promise.resolve([]),
            apiClient.listRecipes({ active_only: true }),
            apiClient.listRecipeCategories(),
            apiClient.listRecipeTags(),
          ]);
        if (!active) return;
        setChildren(childRows);
        setAllRecipes(recipeRows.filter((row) => row.id !== detail.id));
        setCategories(categoryRows);
        setTags(tagRows);
        setFeedbackChildId(
          childRows[0]?.id !== undefined ? String(childRows[0].id) : "",
        );
      } catch (loadError: unknown) {
        if (active) setError(formatApiError(loadError));
      }
    }

    void loadRecipe();
    return () => {
      active = false;
      scaleGeneration.current++;
      mutationGeneration.current++;
    };
  }, [recipeId, identity, canManage, canReadChildren]);

  async function applyScale(
    value: string,
    kind: "servings" | "multiplier",
  ): Promise<void> {
    const ticket = ++scaleRequest.current;
    const id = recipe?.id;
    const numeric = Number(value);
    setScaleError(null);
    if (id === undefined || !Number.isFinite(numeric) || numeric <= 0) {
      setScaling(false);
      setScaleError(
        "Enter a positive number for scaling. The last applied scale is unchanged.",
      );
      return;
    }
    setScaling(true);
    try {
      const result = await apiClient.scaleRecipe(
        id,
        kind === "servings"
          ? { targetServings: numeric }
          : { scaleFactor: numeric },
      );
      if (ticket !== scaleRequest.current || currentRecipeId.current !== id)
        return;
      setScaled(result);
      setTargetServings(
        result.target_servings === null
          ? ""
          : formatScaleInput(result.target_servings),
      );
      setScaleMultiplier(formatScaleInput(result.factor));
    } catch (error) {
      if (ticket === scaleRequest.current && currentRecipeId.current === id)
        setScaleError(
          `Could not apply scale: ${formatApiError(error)}. The last applied scale is unchanged.`,
        );
    } finally {
      if (ticket === scaleRequest.current && currentRecipeId.current === id)
        setScaling(false);
    }
  }

  async function scaleToServings(value: string): Promise<void> {
    setTargetServings(value);
    await applyScale(value, "servings");
  }

  async function scaleToMultiplier(value: string): Promise<void> {
    setScaleMultiplier(value);
    await applyScale(value, "multiplier");
  }

  function mutationCurrent(ticket: number, id: number): boolean {
    return (
      ticket === mutationEpoch.current &&
      currentRecipeId.current === id &&
      liveAccess.current.identity === identity &&
      liveAccess.current.canManage
    );
  }

  async function updateRecipe(): Promise<void> {
    if (
      recipe === null ||
      currentRecipeId.current !== recipe.id ||
      !liveAccess.current.canManage ||
      liveAccess.current.identity !== identity ||
      !canEditRecipe
    )
      return;
    const ticket = mutationEpoch.current;
    setError(null);
    try {
      const updated = await apiClient.updateRecipe(
        recipe.id,
        buildRecipePayloadForUpdate(editPayload, recipe.id),
      );
      if (!mutationCurrent(ticket, recipe.id)) return;
      setRecipe(updated);
      setEditPayload(payloadFromRecipe(updated));
      setEditing(false);
      setMessage(`Updated ${updated.title}.`);
    } catch (updateError: unknown) {
      if (mutationCurrent(ticket, recipe.id))
        setError(formatApiError(updateError));
    }
  }

  async function addVariant(): Promise<void> {
    if (
      recipe === null ||
      currentRecipeId.current !== recipe.id ||
      !liveAccess.current.canManage ||
      liveAccess.current.identity !== identity
    )
      return;
    const ticket = mutationEpoch.current;
    const title = `${recipe.title} Variant`;
    setError(null);
    try {
      const variant = await apiClient.duplicateRecipe(recipe.id, {
        title,
        as_variant: true,
      });
      if (!mutationCurrent(ticket, recipe.id)) return;
      setMessage(`Created variant ${variant.title}.`);
      await reloadRecipe(recipe.id);
    } catch (variantError: unknown) {
      if (mutationCurrent(ticket, recipe.id))
        setError(formatApiError(variantError));
    }
  }

  async function saveFeedback(): Promise<void> {
    if (
      recipe === null ||
      currentUser === null ||
      currentRecipeId.current !== recipe.id ||
      !liveAccess.current.canManage ||
      liveAccess.current.identity !== identity
    )
      return;
    const ticket = mutationEpoch.current;
    const numericRating = feedbackRating === "" ? null : Number(feedbackRating);
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
      if (!mutationCurrent(ticket, recipe.id)) return;
      setMessage("Saved family feedback.");
      setFeedbackVerdict("");
      setFeedbackNotes("");
      await reloadRecipe(recipe.id);
    } catch (feedbackError: unknown) {
      if (mutationCurrent(ticket, recipe.id))
        setError(formatApiError(feedbackError));
    }
  }

  async function deleteRecipe(): Promise<boolean> {
    if (
      recipe === null ||
      currentRecipeId.current !== recipe.id ||
      !liveAccess.current.canManage ||
      liveAccess.current.identity !== identity ||
      !canEditRecipe ||
      deleteConfirmText !== recipe.title ||
      deletingRecipe
    ) {
      return false;
    }
    const ticket = mutationEpoch.current;
    setError(null);
    setDeletingRecipe(true);
    try {
      await apiClient.deleteRecipe(recipe.id);
      return mutationCurrent(ticket, recipe.id);
    } catch (deleteError: unknown) {
      if (mutationCurrent(ticket, recipe.id)) {
        setError(formatApiError(deleteError));
        setDeletingRecipe(false);
      }
      return false;
    }
  }

  const displayedIngredients: DisplayedRecipeIngredient[] =
    scaled?.ingredients ?? recipe?.ingredients ?? [];
  const displayedSteps: DisplayedRecipeStep[] =
    scaled?.steps ?? recipe?.steps ?? [];
  const currentStep = displayedSteps[currentStepIndex];
  const canEditRecipe =
    canManage &&
    currentUser !== null &&
    (currentUser.id === recipe?.owner_user_id ||
      currentUser.role === "PARENT_ADMIN");
  const linkedCurrentIngredients = useMemo(() => {
    if (currentStep === undefined || recipe === null) return [];
    const refs =
      "ingredient_position_refs" in currentStep
        ? currentStep.ingredient_position_refs
        : [];
    return (scaled?.ingredients ?? recipe.ingredients).filter((ingredient) =>
      refs.includes(ingredient.position),
    );
  }, [currentStep, recipe, scaled]);

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
    appliedServings:
      scaled?.target_servings != null
        ? formatScaleInput(scaled.target_servings)
        : recipe?.servings != null
          ? formatScaleInput(recipe.servings)
          : "",
    appliedMultiplier: formatScaleInput(scaled?.factor ?? 1),
    scaling,
    scaleError,
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
