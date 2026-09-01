from __future__ import annotations

from datetime import UTC, date, datetime
import secrets

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, TimestampMixin
from app.models.enums import (
    AssignmentMode,
    CompletionMode,
    CompletionStatus,
    ScheduleMode,
    ScheduleUnit,
    SubmissionStatus,
    TransactionType,
    UserRole,
)

class QuickTemplate(TimestampMixin, Base):
    __tablename__ = "quick_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    reward_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    completion_mode: Mapped[CompletionMode] = mapped_column(Enum(CompletionMode, native_enum=False), nullable=False)


class RecipeCategory(TimestampMixin, Base):
    __tablename__ = "recipe_categories"
    __table_args__ = (UniqueConstraint("owner_user_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False
    )
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(32), nullable=False, default="#f97316")


class RecipeTag(TimestampMixin, Base):
    __tablename__ = "recipe_tags"
    __table_args__ = (UniqueConstraint("owner_user_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False
    )
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)


class Recipe(TimestampMixin, Base):
    __tablename__ = "recipes"
    __table_args__ = (
        CheckConstraint("prep_minutes IS NULL OR prep_minutes >= 0", name="recipe_prep_minutes_non_negative"),
        CheckConstraint("cook_minutes IS NULL OR cook_minutes >= 0", name="recipe_cook_minutes_non_negative"),
        CheckConstraint("servings IS NULL OR servings > 0", name="recipe_servings_positive"),
        CheckConstraint("yield_quantity IS NULL OR yield_quantity > 0", name="recipe_yield_quantity_positive"),
        CheckConstraint("rating IS NULL OR (rating >= 1 AND rating <= 5)", name="recipe_rating_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False
    )
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_recipe_id: Mapped[int | None] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    photo_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    source_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    prep_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cook_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    servings: Mapped[float | None] = mapped_column(Float, nullable=True)
    yield_quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    yield_unit: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str] = mapped_column(String(4000), nullable=False, default="")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RecipeCategoryLink(Base):
    __tablename__ = "recipe_category_links"

    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("recipe_categories.id", ondelete="CASCADE"), primary_key=True)


class RecipeTagLink(Base):
    __tablename__ = "recipe_tag_links"

    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("recipe_tags.id", ondelete="CASCADE"), primary_key=True)


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"
    __table_args__ = (UniqueConstraint("recipe_id", "position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    group_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    item: Mapped[str] = mapped_column(String(255), nullable=False)
    preparation: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    note: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    is_optional: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class RecipeStep(Base):
    __tablename__ = "recipe_steps"
    __table_args__ = (UniqueConstraint("recipe_id", "position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    section: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    instruction: Mapped[str] = mapped_column(String(2000), nullable=False)


class RecipeStepIngredientLink(Base):
    __tablename__ = "recipe_step_ingredient_links"

    step_id: Mapped[int] = mapped_column(ForeignKey("recipe_steps.id", ondelete="CASCADE"), primary_key=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("recipe_ingredients.id", ondelete="CASCADE"), primary_key=True)


class RecipeComponent(Base):
    __tablename__ = "recipe_components"
    __table_args__ = (CheckConstraint("parent_recipe_id != component_recipe_id", name="recipe_component_not_self"),)

    parent_recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True)
    component_recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(64), nullable=False, default="")


class RecipeFeedback(TimestampMixin, Base):
    __tablename__ = "recipe_feedback"
    __table_args__ = (
        UniqueConstraint("recipe_id", "reviewer_type", "reviewer_key"),
        CheckConstraint("rating IS NULL OR (rating >= 1 AND rating <= 5)", name="recipe_feedback_rating_range"),
        CheckConstraint("reviewer_type IN ('PARENT', 'CHILD')", name="recipe_feedback_reviewer_type"),
        CheckConstraint(
            "(reviewer_type = 'PARENT' AND parent_user_id IS NOT NULL AND child_id IS NULL) OR "
            "(reviewer_type = 'CHILD' AND child_id IS NOT NULL AND parent_user_id IS NULL)",
            name="recipe_feedback_reviewer_target",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_type: Mapped[str] = mapped_column(String(16), nullable=False)
    reviewer_key: Mapped[str] = mapped_column(String(64), nullable=False)
    parent_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    child_id: Mapped[int | None] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=True, index=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verdict: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    notes: Mapped[str] = mapped_column(String(2000), nullable=False, default="")


