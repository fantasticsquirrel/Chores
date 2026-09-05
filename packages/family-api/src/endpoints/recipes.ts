import type { RequestQuery } from "../client-core";
import type {
  CreateRecipeCategoryRequest,
  CreateRecipeRequest,
  CreateRecipeTagRequest,
  DuplicateRecipeRequest,
  ImportRecipeBackupResponse,
  ListRecipesParams,
  RecipeBackup,
  RecipeCategory,
  RecipeDetail,
  RecipeFeedback,
  RecipeScaleResponse,
  RecipeSummary,
  RecipeTag,
  UpdateRecipeRequest,
  UpsertRecipeFeedbackRequest,
} from "../models/recipes";
import { FamilyCoreApiEndpoints } from "./core";

export abstract class FamilyRecipeApiEndpoints extends FamilyCoreApiEndpoints {
  async listRecipeCategories(): Promise<RecipeCategory[]> {
    return this.get<RecipeCategory[]>("/recipes/categories");
  }

  async createRecipeCategory(
    payload: CreateRecipeCategoryRequest,
  ): Promise<RecipeCategory> {
    return this.post<RecipeCategory, CreateRecipeCategoryRequest>(
      "/recipes/categories",
      payload,
    );
  }

  async updateRecipeCategory(
    categoryId: number,
    payload: CreateRecipeCategoryRequest,
  ): Promise<RecipeCategory> {
    return this.put<RecipeCategory, CreateRecipeCategoryRequest>(
      `/recipes/categories/${categoryId}`,
      payload,
    );
  }

  async deleteRecipeCategory(categoryId: number): Promise<void> {
    return this.delete(`/recipes/categories/${categoryId}`);
  }

  async listRecipeTags(): Promise<RecipeTag[]> {
    return this.get<RecipeTag[]>("/recipes/tags");
  }

  async createRecipeTag(payload: CreateRecipeTagRequest): Promise<RecipeTag> {
    return this.post<RecipeTag, CreateRecipeTagRequest>(
      "/recipes/tags",
      payload,
    );
  }

  async updateRecipeTag(
    tagId: number,
    payload: CreateRecipeTagRequest,
  ): Promise<RecipeTag> {
    return this.put<RecipeTag, CreateRecipeTagRequest>(
      `/recipes/tags/${tagId}`,
      payload,
    );
  }

  async deleteRecipeTag(tagId: number): Promise<void> {
    return this.delete(`/recipes/tags/${tagId}`);
  }

  async listRecipes(params: ListRecipesParams = {}): Promise<RecipeSummary[]> {
    return this.get<RecipeSummary[]>("/recipes", params as RequestQuery);
  }

  async getRecipe(recipeId: number): Promise<RecipeDetail> {
    return this.get<RecipeDetail>(`/recipes/${recipeId}`);
  }

  async createRecipe(payload: CreateRecipeRequest): Promise<RecipeDetail> {
    return this.post<RecipeDetail, CreateRecipeRequest>("/recipes", payload);
  }

  async importRecipeFromUrl(url: string): Promise<RecipeDetail> {
    return this.post<RecipeDetail, { url: string }>("/recipes/import-url", {
      url,
    });
  }

  async exportRecipeBackup(): Promise<RecipeBackup> {
    return this.get<RecipeBackup>("/recipes/backup");
  }

  async importRecipeBackup(
    recipes: CreateRecipeRequest[],
  ): Promise<ImportRecipeBackupResponse> {
    return this.post<
      ImportRecipeBackupResponse,
      { recipes: CreateRecipeRequest[] }
    >("/recipes/backup/import", { recipes });
  }

  async updateRecipe(
    recipeId: number,
    payload: UpdateRecipeRequest,
  ): Promise<RecipeDetail> {
    return this.put<RecipeDetail, UpdateRecipeRequest>(
      `/recipes/${recipeId}`,
      payload,
    );
  }

  async archiveRecipe(
    recipeId: number,
    archived: boolean,
  ): Promise<RecipeDetail> {
    return this.patch<RecipeDetail, { archived: boolean }>(
      `/recipes/${recipeId}/archive`,
      { archived },
    );
  }

  async deleteRecipe(recipeId: number): Promise<void> {
    return this.delete(`/recipes/${recipeId}`);
  }

  async duplicateRecipe(
    recipeId: number,
    payload: DuplicateRecipeRequest,
  ): Promise<RecipeDetail> {
    return this.post<RecipeDetail, DuplicateRecipeRequest>(
      `/recipes/${recipeId}/duplicate`,
      payload,
    );
  }

  async createRecipeVariant(
    recipeId: number,
    payload: CreateRecipeRequest,
  ): Promise<RecipeDetail> {
    return this.post<RecipeDetail, CreateRecipeRequest>(
      `/recipes/${recipeId}/variants`,
      payload,
    );
  }

  async upsertRecipeFeedback(
    recipeId: number,
    payload: UpsertRecipeFeedbackRequest,
  ): Promise<RecipeFeedback> {
    return this.put<RecipeFeedback, UpsertRecipeFeedbackRequest>(
      `/recipes/${recipeId}/feedback`,
      payload,
    );
  }

  async scaleRecipe(
    recipeId: number,
    options: { targetServings?: number; scaleFactor?: number },
  ): Promise<RecipeScaleResponse> {
    return this.get<RecipeScaleResponse>(`/recipes/${recipeId}/scale`, {
      target_servings: options.targetServings,
      scale_factor: options.scaleFactor,
    });
  }
}
