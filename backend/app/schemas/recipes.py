from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator


class RecipeCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    owner_user_id: int
    name: str
    color: str


class RecipeTagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    owner_user_id: int
    name: str


class CreateRecipeCategoryRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#f97316", min_length=1, max_length=32)


class UpdateRecipeCategoryRequest(CreateRecipeCategoryRequest):
    pass


class CreateRecipeTagRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)


class UpdateRecipeTagRequest(CreateRecipeTagRequest):
    pass


class RecipeIngredientPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    position: int = Field(gt=0)
    group_name: str = Field(default="", max_length=100)
    quantity: float | None = Field(default=None, gt=0)
    unit: str = Field(default="", max_length=64)
    item: str = Field(min_length=1, max_length=255)
    preparation: str = Field(default="", max_length=255)
    note: str = Field(default="", max_length=500)
    is_optional: bool = False


class RecipeIngredientResponse(RecipeIngredientPayload):
    id: int
    recipe_id: int


class RecipeStepPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    position: int = Field(gt=0)
    section: str = Field(default="", max_length=100)
    instruction: str = Field(min_length=1, max_length=2000)
    ingredient_position_refs: list[int] = Field(default_factory=list)


class RecipeStepResponse(RecipeStepPayload):
    id: int
    recipe_id: int
    ingredient_ids: list[int] = Field(default_factory=list)


class RecipeComponentPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    component_recipe_id: int = Field(gt=0)
    label: str = Field(default="", max_length=100)
    quantity: float | None = Field(default=None, gt=0)
    unit: str = Field(default="", max_length=64)


class RecipeComponentResponse(RecipeComponentPayload):
    component_recipe: "RecipeSummaryResponse"


class RecipeBasePayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    parent_recipe_id: int | None = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    photo_url: HttpUrl | None = None
    source_name: str = Field(default="", max_length=255)
    source_url: HttpUrl | None = None
    prep_minutes: int | None = Field(default=None, ge=0)
    cook_minutes: int | None = Field(default=None, ge=0)
    servings: float | None = Field(default=None, gt=0)
    yield_quantity: float | None = Field(default=None, gt=0)
    yield_unit: str = Field(default="", max_length=64)
    rating: int | None = Field(default=None, ge=1, le=5)
    favorite: bool = False
    notes: str = Field(default="", max_length=4000)
    category_ids: list[int] = Field(default_factory=list)
    tag_ids: list[int] = Field(default_factory=list)
    ingredients: list[RecipeIngredientPayload] = Field(default_factory=list)
    steps: list[RecipeStepPayload] = Field(default_factory=list)
    components: list[RecipeComponentPayload] = Field(default_factory=list)

    @field_validator("category_ids", "tag_ids")
    @classmethod
    def unique_ids(cls, value: list[int]) -> list[int]:
        if any(item <= 0 for item in value):
            raise ValueError("ids must be positive.")
        if len(set(value)) != len(value):
            raise ValueError("ids must be unique.")
        return value

    @model_validator(mode="after")
    def unique_positions_and_components(self) -> "RecipeBasePayload":
        ingredient_positions = [ingredient.position for ingredient in self.ingredients]
        if len(set(ingredient_positions)) != len(ingredient_positions):
            raise ValueError("ingredient positions must be unique.")
        step_positions = [step.position for step in self.steps]
        if len(set(step_positions)) != len(step_positions):
            raise ValueError("step positions must be unique.")
        valid_ingredient_positions = set(ingredient_positions)
        for step in self.steps:
            if len(set(step.ingredient_position_refs)) != len(step.ingredient_position_refs):
                raise ValueError("step ingredient references must be unique.")
            if any(ref <= 0 or ref not in valid_ingredient_positions for ref in step.ingredient_position_refs):
                raise ValueError("step ingredient references must point to ingredient positions in this recipe.")
        component_ids = [component.component_recipe_id for component in self.components]
        if len(set(component_ids)) != len(component_ids):
            raise ValueError("component recipes must be unique.")
        return self


class CreateRecipeRequest(RecipeBasePayload):
    pass


class UpdateRecipeRequest(RecipeBasePayload):
    pass


class ImportRecipeUrlRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    url: HttpUrl


class ImportRecipeBackupRequest(BaseModel):
    recipes: list[CreateRecipeRequest] = Field(default_factory=list)


class ImportRecipeBackupResponse(BaseModel):
    imported_count: int
    recipes: list["RecipeDetailResponse"]



class ArchiveRecipeRequest(BaseModel):
    archived: bool


class DuplicateRecipeRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=255)
    as_variant: bool = False


class UpsertRecipeFeedbackRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    reviewer_type: Literal["PARENT", "CHILD"]
    parent_user_id: int | None = Field(default=None, gt=0)
    child_id: int | None = Field(default=None, gt=0)
    rating: int | None = Field(default=None, ge=1, le=5)
    verdict: str = Field(default="", max_length=100)
    notes: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def one_reviewer_target(self) -> "UpsertRecipeFeedbackRequest":
        if self.reviewer_type == "PARENT" and (self.parent_user_id is None or self.child_id is not None):
            raise ValueError("parent feedback requires parent_user_id only.")
        if self.reviewer_type == "CHILD" and (self.child_id is None or self.parent_user_id is not None):
            raise ValueError("child feedback requires child_id only.")
        return self


class RecipeFeedbackResponse(BaseModel):
    id: int
    recipe_id: int
    household_id: int
    reviewer_type: Literal["PARENT", "CHILD"]
    parent_user_id: int | None
    child_id: int | None
    reviewer_name: str
    rating: int | None
    verdict: str
    notes: str
    created_at: datetime


class RecipeFeedbackSummary(BaseModel):
    average_rating: float | None = None
    rating_count: int = 0


class RecipeSummaryResponse(BaseModel):
    id: int
    household_id: int
    owner_user_id: int
    parent_recipe_id: int | None
    title: str
    description: str
    photo_url: str | None
    source_name: str
    source_url: str | None
    prep_minutes: int | None
    cook_minutes: int | None
    servings: float | None
    yield_quantity: float | None
    yield_unit: str
    rating: int | None
    favorite: bool
    notes: str
    archived_at: datetime | None
    categories: list[RecipeCategoryResponse] = Field(default_factory=list)
    tags: list[RecipeTagResponse] = Field(default_factory=list)
    ingredient_count: int = 0
    feedback_summary: RecipeFeedbackSummary = Field(default_factory=RecipeFeedbackSummary)


class RecipeDetailResponse(RecipeSummaryResponse):
    ingredients: list[RecipeIngredientResponse] = Field(default_factory=list)
    steps: list[RecipeStepResponse] = Field(default_factory=list)
    components: list[RecipeComponentResponse] = Field(default_factory=list)
    variants: list[RecipeSummaryResponse] = Field(default_factory=list)
    core_recipe: RecipeSummaryResponse | None = None
    feedback: list[RecipeFeedbackResponse] = Field(default_factory=list)


class ScaledIngredientResponse(RecipeIngredientResponse):
    scaled_quantity: float | None


class ScaledStepResponse(RecipeStepResponse):
    scaled_instruction: str
    linked_ingredients: list[ScaledIngredientResponse] = Field(default_factory=list)


class RecipeScaleResponse(BaseModel):
    recipe_id: int
    base_servings: float | None
    target_servings: float | None
    factor: float
    warnings: list[str]
    ingredients: list[ScaledIngredientResponse]
    steps: list[ScaledStepResponse] = Field(default_factory=list)
