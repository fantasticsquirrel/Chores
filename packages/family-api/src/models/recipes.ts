export interface RecipeCategory {
  id: number;
  household_id: number;
  owner_user_id: number;
  name: string;
  color: string;
}

export interface RecipeTag {
  id: number;
  household_id: number;
  owner_user_id: number;
  name: string;
}

export interface RecipeIngredient {
  id: number;
  recipe_id: number;
  position: number;
  group_name: string;
  quantity: number | null;
  unit: string;
  item: string;
  preparation: string;
  note: string;
  is_optional: boolean;
}

export interface RecipeStep {
  id: number;
  recipe_id: number;
  position: number;
  section: string;
  instruction: string;
  ingredient_position_refs: number[];
  ingredient_ids: number[];
}

export interface RecipeSummary {
  id: number;
  household_id: number;
  owner_user_id: number;
  creator_email?: string;
  parent_recipe_id: number | null;
  title: string;
  description: string;
  photo_url: string | null;
  source_name: string;
  source_url: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  yield_quantity: number | null;
  yield_unit: string;
  rating: number | null;
  favorite: boolean;
  notes: string;
  archived_at: string | null;
  categories: RecipeCategory[];
  tags: RecipeTag[];
  ingredient_count: number;
  feedback_summary: RecipeFeedbackSummary;
}

export type RecipeFeedbackReviewerType = "PARENT" | "CHILD";

export interface RecipeFeedbackSummary {
  average_rating: number | null;
  rating_count: number;
}

export interface RecipeFeedback {
  id: number;
  recipe_id: number;
  household_id: number;
  reviewer_type: RecipeFeedbackReviewerType;
  parent_user_id: number | null;
  child_id: number | null;
  reviewer_name: string;
  rating: number | null;
  verdict: string;
  notes: string;
  created_at: string;
}

export interface RecipeComponent {
  component_recipe_id: number;
  label: string;
  quantity: number | null;
  unit: string;
  component_recipe: RecipeSummary;
}

export interface RecipeDetail extends RecipeSummary {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  components: RecipeComponent[];
  variants: RecipeSummary[];
  core_recipe: RecipeSummary | null;
  feedback: RecipeFeedback[];
}

export interface CreateRecipeCategoryRequest {
  name: string;
  color?: string;
}

export type UpdateRecipeCategoryRequest = CreateRecipeCategoryRequest;

export interface CreateRecipeTagRequest {
  name: string;
}

export type UpdateRecipeTagRequest = CreateRecipeTagRequest;

export interface RecipeIngredientRequest {
  position: number;
  group_name?: string;
  quantity?: number | null;
  unit?: string;
  item: string;
  preparation?: string;
  note?: string;
  is_optional?: boolean;
}

export interface RecipeStepRequest {
  position: number;
  section?: string;
  instruction: string;
  ingredient_position_refs?: number[];
}

export interface RecipeComponentRequest {
  component_recipe_id: number;
  label?: string;
  quantity?: number | null;
  unit?: string;
}

export interface CreateRecipeRequest {
  parent_recipe_id?: number | null;
  title: string;
  description?: string;
  photo_url?: string | null;
  source_name?: string;
  source_url?: string | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  servings?: number | null;
  yield_quantity?: number | null;
  yield_unit?: string;
  rating?: number | null;
  favorite?: boolean;
  notes?: string;
  category_ids?: number[];
  tag_ids?: number[];
  ingredients?: RecipeIngredientRequest[];
  steps?: RecipeStepRequest[];
  components?: RecipeComponentRequest[];
}

export type UpdateRecipeRequest = CreateRecipeRequest;

export interface ListRecipesParams {
  query?: string;
  category_id?: number;
  tag_id?: number;
  favorite?: boolean;
  min_rating?: number;
  ingredient?: string;
  active_only?: boolean;
}

export interface DuplicateRecipeRequest {
  title?: string | null;
  as_variant?: boolean;
}

export interface ImportRecipeBackupResponse {
  imported_count: number;
  recipes: RecipeDetail[];
}

export interface RecipeBackup {
  version: number;
  recipes: RecipeDetail[];
}

export interface UpsertRecipeFeedbackRequest {
  reviewer_type: RecipeFeedbackReviewerType;
  parent_user_id?: number | null;
  child_id?: number | null;
  rating?: number | null;
  verdict?: string;
  notes?: string;
}

export interface RecipeScaleResponse {
  recipe_id: number;
  base_servings: number | null;
  target_servings: number | null;
  factor: number;
  warnings: string[];
  ingredients: Array<RecipeIngredient & { scaled_quantity: number | null }>;
  steps: Array<
    RecipeStep & {
      scaled_instruction: string;
      linked_ingredients: Array<
        RecipeIngredient & { scaled_quantity: number | null }
      >;
    }
  >;
}
