import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";

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
  error: string | null;
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

export function useRecipeOrganizer(): UseRecipeOrganizerResult {
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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadRecipes = useCallback(async (filters: RecipeFilters) => {
    setError(null);
    try {
      const [categoryRows, tagRows, recipeRows] = await Promise.all([
        apiClient.listRecipeCategories(),
        apiClient.listRecipeTags(),
        apiClient.listRecipes(filters),
      ]);
      setCategories(categoryRows);
      setTags(tagRows);
      setRecipes(recipeRows);
    } catch (loadError: unknown) {
      setError(formatApiError(loadError));
    }
  }, []);

  useEffect(() => {
    void loadRecipes(EMPTY_FILTERS);
  }, [loadRecipes]);

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

  async function createRecipe(): Promise<RecipeDetail | null> {
    setError(null);
    try {
      const saved = await apiClient.createRecipe(
        buildRecipePayloadForSave(payload),
      );
      setMessage(`Saved ${saved.title}.`);
      setEditing(false);
      setPayload(buildEmptyRecipePayload());
      await refresh();
      return saved;
    } catch (saveError: unknown) {
      setError(formatApiError(saveError));
      return null;
    }
  }

  async function importRecipeFromUrl(): Promise<RecipeDetail | null> {
    if (importUrl.trim() === "") return null;
    setError(null);
    try {
      const imported = await apiClient.importRecipeFromUrl(importUrl.trim());
      setImportUrl("");
      setMessage(`Imported ${imported.title}.`);
      await refresh();
      return imported;
    } catch (importError: unknown) {
      setError(formatApiError(importError));
      return null;
    }
  }

  async function exportBackup(): Promise<void> {
    const backup = await apiClient.exportRecipeBackup();
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
  }

  async function importBackup(): Promise<void> {
    setError(null);
    try {
      const parsed = JSON.parse(backupJson) as { recipes?: RecipeDetail[] };
      const recipesToImport = (parsed.recipes ?? []).map(backupRecipeToPayload);
      const result = await apiClient.importRecipeBackup(recipesToImport);
      setBackupJson("");
      setMessage(`Imported ${result.imported_count} recipes from backup.`);
      await refresh();
    } catch (backupError: unknown) {
      setError(formatApiError(backupError));
    }
  }

  return {
    backupJson,
    categories,
    categoryId,
    createRecipe,
    editing,
    error,
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
