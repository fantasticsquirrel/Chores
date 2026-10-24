import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  apiClient,
  type CreateRecipeRequest,
  type RecipeCategory,
  type RecipeDetail,
  type RecipeSummary,
  type RecipeTag,
} from "../../../api";
import { formatApiError } from "../../../lib/errors";
import {
  backupRecipeToPayload,
  buildEmptyRecipePayload,
  buildRecipePayloadForSave,
} from "../lib/payloadMapping";

type RecipeFilters = {
  category_id: number | undefined;
  favorite: true | undefined;
  ingredient: string | undefined;
  min_rating: number | undefined;
  query: string | undefined;
  tag_id: number | undefined;
};

export type UseRecipeOrganizerResult = {
  backupJson: string;
  categories: RecipeCategory[];
  categoryId: string;
  createRecipe: () => Promise<RecipeDetail | null>;
  editing: boolean;
  loading: boolean;
  loaded: boolean;
  hasAppliedFilters: boolean;
  taxonomyError: string | null;
  retryTaxonomy: () => Promise<void>;
  resetFilters: () => Promise<void>;
  error: string | null;
  mutationError: string | null;
  saving: boolean;
  exportBackup: () => Promise<void>;
  favoriteOnly: boolean;
  importBackup: () => Promise<void>;
  importRecipeFromUrl: () => Promise<RecipeDetail | null>;
  importUrl: string;
  ingredient: string;
  message: string | null;
  minRating: string;
  payload: CreateRecipeRequest;
  query: string;
  recipes: RecipeSummary[];
  refresh: () => Promise<void>;
  setBackupJson: (value: string) => void;
  setCategoryId: (value: string) => void;
  setEditing: (value: boolean) => void;
  setFavoriteOnly: (value: boolean) => void;
  setImportUrl: (value: string) => void;
  setIngredient: (value: string) => void;
  setMinRating: (value: string) => void;
  setPayload: Dispatch<SetStateAction<CreateRecipeRequest>>;
  setQuery: (value: string) => void;
  setShowAdvancedFilters: Dispatch<SetStateAction<boolean>>;
  setShowBackupTools: Dispatch<SetStateAction<boolean>>;
  setTagId: (value: string) => void;
  showAdvancedFilters: boolean;
  showBackupTools: boolean;
  tagId: string;
  tags: RecipeTag[];
};

const EMPTY_FILTERS: RecipeFilters = {
  category_id: undefined,
  favorite: undefined,
  ingredient: undefined,
  min_rating: undefined,
  query: undefined,
  tag_id: undefined,
};

export function useRecipeOrganizer(
  workflowKey = "cookbook",
  canManage = true,
): UseRecipeOrganizerResult {
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [editing, setEditing] = useState(false);
  const [payload, setPayload] = useState<CreateRecipeRequest>(
    buildEmptyRecipePayload(),
  );
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
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const mounted = useRef(true);
  const request = useRef(0);
  const taxonomyRequest = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const writeLock = useRef(false);
  const currentDraft = useRef({
    payload,
    importUrl,
    backupJson,
    workflowKey,
    canManage,
  });
  currentDraft.current = {
    payload,
    importUrl,
    backupJson,
    workflowKey,
    canManage,
  };
  const latestFilters = useRef(EMPTY_FILTERS);
  useEffect(() => {
    setMutationError(null);
  }, [workflowKey]);

  const loadRecipes = useCallback(async (filters: RecipeFilters) => {
    const ticket = ++request.current;
    setLoading(true);
    setError(null);
    setHasAppliedFilters(
      Object.values(filters).some((value) => value !== undefined),
    );
    try {
      const recipeRows = await apiClient.listRecipes(filters);
      if (mounted.current && ticket === request.current) {
        setRecipes(recipeRows);
        setLoaded(true);
      }
    } catch (loadError: unknown) {
      if (mounted.current && ticket === request.current)
        setError(formatApiError(loadError));
    } finally {
      if (mounted.current && ticket === request.current) setLoading(false);
    }
  }, []);

  const loadTaxonomy = useCallback(async () => {
    const ticket = ++taxonomyRequest.current;
    setTaxonomyError(null);
    const results = await Promise.allSettled([
      apiClient.listRecipeCategories(),
      apiClient.listRecipeTags(),
    ]);
    if (!mounted.current || ticket !== taxonomyRequest.current) return;
    if (results[0].status === "fulfilled") setCategories(results[0].value);
    if (results[1].status === "fulfilled") setTags(results[1].value);
    if (results.some((result) => result.status === "rejected"))
      setTaxonomyError(
        "Some categories or tags could not load. Recipes are still available.",
      );
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadRecipes(EMPTY_FILTERS);
    void loadTaxonomy();
    const recipesGeneration = request;
    const taxonomyGeneration = taxonomyRequest;
    return () => {
      mounted.current = false;
      recipesGeneration.current++;
      taxonomyGeneration.current++;
    };
  }, [loadRecipes, loadTaxonomy]);

  async function resetFilters(): Promise<void> {
    setQuery("");
    setIngredient("");
    setCategoryId("");
    setTagId("");
    setFavoriteOnly(false);
    setMinRating("");
    await loadRecipes(EMPTY_FILTERS);
  }

  function currentFilters(): RecipeFilters {
    return {
      query: query || undefined,
      ingredient: ingredient || undefined,
      category_id: categoryId === "" ? undefined : Number(categoryId),
      tag_id: tagId === "" ? undefined : Number(tagId),
      favorite: favoriteOnly ? true : undefined,
      min_rating: minRating === "" ? undefined : Number(minRating),
    };
  }

  async function refresh(): Promise<void> {
    await loadRecipes(currentFilters());
  }

  latestFilters.current = currentFilters();

  async function write<T>(
    operation: () => Promise<T>,
    apply: (value: T) => void,
    unchanged: () => boolean,
  ): Promise<T | null> {
    if (writeLock.current || !currentDraft.current.canManage) return null;
    writeLock.current = true;
    setSaving(true);
    setMutationError(null);
    const isCurrent = () =>
      mounted.current &&
      currentDraft.current.workflowKey === workflowKey &&
      currentDraft.current.canManage &&
      unchanged();
    try {
      const result = await operation();
      const currentBeforeRefresh = isCurrent();
      if (mounted.current) await loadRecipes(latestFilters.current);
      // Only clear the submitted draft and return a navigation target if it
      // stayed current through both the write and the cookbook refresh.
      if (!currentBeforeRefresh || !isCurrent()) return null;
      apply(result);
      return result;
    } catch (failure) {
      if (isCurrent()) setMutationError(formatApiError(failure));
      return null;
    } finally {
      writeLock.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  async function createRecipe(): Promise<RecipeDetail | null> {
    const draft = payload;
    return write(
      () => apiClient.createRecipe(buildRecipePayloadForSave(draft)),
      (saved) => {
        setMessage(`Saved ${saved.title}.`);
        setEditing(false);
        setPayload(buildEmptyRecipePayload());
      },
      () => currentDraft.current.payload === draft,
    );
  }

  async function importRecipeFromUrl(): Promise<RecipeDetail | null> {
    if (importUrl.trim() === "") return null;
    const draft = importUrl;
    return write(
      () => apiClient.importRecipeFromUrl(draft.trim()),
      (imported) => {
        setImportUrl("");
        setMessage(`Imported ${imported.title}.`);
      },
      () => currentDraft.current.importUrl === draft,
    );
  }

  async function exportBackup(): Promise<void> {
    const scope = workflowKey;
    try {
      const backup = await apiClient.exportRecipeBackup();
      if (!mounted.current || currentDraft.current.workflowKey !== scope)
        return;
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "family-manager-recipes-backup.json";
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`Exported ${backup.recipes.length} recipes.`);
    } catch (failure) {
      if (mounted.current && currentDraft.current.workflowKey === scope)
        setMutationError(formatApiError(failure));
    }
  }

  async function importBackup(): Promise<void> {
    const draft = backupJson;
    await write(
      async () => {
        const parsed = JSON.parse(draft) as { recipes?: RecipeDetail[] };
        return apiClient.importRecipeBackup(
          (parsed.recipes ?? []).map(backupRecipeToPayload),
        );
      },
      (result) => {
        setBackupJson("");
        setMessage(`Imported ${result.imported_count} recipes from backup.`);
      },
      () => currentDraft.current.backupJson === draft,
    );
  }

  return {
    backupJson,
    categories,
    categoryId,
    createRecipe,
    editing,
    loading,
    loaded,
    hasAppliedFilters,
    taxonomyError,
    retryTaxonomy: loadTaxonomy,
    resetFilters,
    error,
    mutationError,
    saving,
    exportBackup,
    favoriteOnly,
    importBackup,
    importRecipeFromUrl,
    importUrl,
    ingredient,
    message,
    minRating,
    payload,
    query,
    recipes,
    refresh,
    setBackupJson,
    setCategoryId,
    setEditing,
    setFavoriteOnly,
    setImportUrl,
    setIngredient,
    setMinRating,
    setPayload,
    setQuery,
    setShowAdvancedFilters,
    setShowBackupTools,
    setTagId,
    showAdvancedFilters,
    showBackupTools,
    tagId,
    tags,
  };
}
