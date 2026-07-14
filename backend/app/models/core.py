from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
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


class Household(TimestampMixin, Base):
    __tablename__ = "households"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")


class Child(TimestampMixin, Base):
    __tablename__ = "children"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("household_id", "email"),
        UniqueConstraint("email", name="uq_users_email"),
        CheckConstraint(
            "(role = 'CHILD' AND child_id IS NOT NULL) OR (role IN ('PARENT_ADMIN', 'PARENT') AND child_id IS NULL)",
            name="user_role_child_link",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False), nullable=False)
    child_id: Mapped[int | None] = mapped_column(ForeignKey("children.id", ondelete="SET NULL"), nullable=True, index=True)


class Module(Base):
    __tablename__ = "modules"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class HouseholdModuleAccess(TimestampMixin, Base):
    __tablename__ = "household_module_access"

    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), primary_key=True)
    module_key: Mapped[str] = mapped_column(ForeignKey("modules.key", ondelete="CASCADE"), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class UserModuleAccess(TimestampMixin, Base):
    __tablename__ = "user_module_access"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    module_key: Mapped[str] = mapped_column(ForeignKey("modules.key", ondelete="CASCADE"), primary_key=True)
    can_view: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    can_manage: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Tag(TimestampMixin, Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("household_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)


class Chore(TimestampMixin, Base):
    __tablename__ = "chores"
    __table_args__ = (
        CheckConstraint("reward_cents >= 0", name="reward_non_negative"),
        CheckConstraint("schedule_interval IS NULL OR schedule_interval > 0", name="positive_schedule_interval"),
        CheckConstraint("timeout_days IS NULL OR timeout_days > 0", name="positive_timeout_days"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    reward_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    expires_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    timeout_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    schedule_mode: Mapped[ScheduleMode] = mapped_column(Enum(ScheduleMode, native_enum=False), nullable=False)
    schedule_interval: Mapped[int | None] = mapped_column(Integer, nullable=True)
    schedule_unit: Mapped[ScheduleUnit | None] = mapped_column(Enum(ScheduleUnit, native_enum=False), nullable=True)
    completion_mode: Mapped[CompletionMode] = mapped_column(Enum(CompletionMode, native_enum=False), nullable=False)
    assignment_mode: Mapped[AssignmentMode] = mapped_column(Enum(AssignmentMode, native_enum=False), nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ChoreAllowedChild(Base):
    __tablename__ = "chore_allowed_children"

    chore_id: Mapped[int] = mapped_column(ForeignKey("chores.id", ondelete="CASCADE"), primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), primary_key=True)


class ChoreRotationMember(Base):
    __tablename__ = "chore_rotation_members"
    __table_args__ = (UniqueConstraint("chore_id", "position"),)

    chore_id: Mapped[int] = mapped_column(ForeignKey("chores.id", ondelete="CASCADE"), primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class ChoreRotationState(Base):
    __tablename__ = "chore_rotation_state"

    chore_id: Mapped[int] = mapped_column(ForeignKey("chores.id", ondelete="CASCADE"), primary_key=True)
    current_position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_occurrence_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class Submission(TimestampMixin, Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    for_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[SubmissionStatus] = mapped_column(Enum(SubmissionStatus, native_enum=False), nullable=False, default=SubmissionStatus.PENDING)


class SubmissionItem(Base):
    __tablename__ = "submission_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    chore_id: Mapped[int] = mapped_column(ForeignKey("chores.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[SubmissionStatus] = mapped_column(Enum(SubmissionStatus, native_enum=False), nullable=False, default=SubmissionStatus.PENDING)


class CompletionRecord(Base):
    __tablename__ = "completion_records"
    __table_args__ = (UniqueConstraint("child_id", "chore_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    chore_id: Mapped[int] = mapped_column(ForeignKey("chores.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[CompletionStatus] = mapped_column(Enum(CompletionStatus, native_enum=False), nullable=False)


class Transaction(TimestampMixin, Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType, native_enum=False), nullable=False)


class HomeschoolSemester(TimestampMixin, Base):
    __tablename__ = "homeschool_semesters"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class HomeschoolSubject(TimestampMixin, Base):
    __tablename__ = "homeschool_subjects"
    __table_args__ = (UniqueConstraint("household_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    color: Mapped[str] = mapped_column(String(32), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class HomeschoolAttendance(TimestampMixin, Base):
    __tablename__ = "homeschool_attendance"
    __table_args__ = (UniqueConstraint("child_id", "subject_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("homeschool_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    present: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    comment: Mapped[str] = mapped_column(String(2000), nullable=False, default="")


class HomeschoolDayComment(TimestampMixin, Base):
    __tablename__ = "homeschool_day_comments"
    __table_args__ = (UniqueConstraint("child_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    comment: Mapped[str] = mapped_column(String(4000), nullable=False, default="")


class HomeschoolGrade(TimestampMixin, Base):
    __tablename__ = "homeschool_grades"
    __table_args__ = (UniqueConstraint("child_id", "subject_id", "semester_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("homeschool_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    semester_id: Mapped[int | None] = mapped_column(ForeignKey("homeschool_semesters.id", ondelete="CASCADE"), nullable=True, index=True)
    grade: Mapped[str] = mapped_column(String(64), nullable=False, default="")


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
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(32), nullable=False, default="#f97316")


class RecipeTag(TimestampMixin, Base):
    __tablename__ = "recipe_tags"
    __table_args__ = (UniqueConstraint("owner_user_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
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


class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = (UniqueConstraint("user_id", "dedup_key", name="uq_notifications_user_dedup_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int | None] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=True, index=True)
    module_key: Mapped[str] = mapped_column(String(64), nullable=False, default="chores", index=True)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="general")
    severity: Mapped[str] = mapped_column(String(32), nullable=False, default="info")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    link_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    dedup_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    in_app_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    __table_args__ = (UniqueConstraint("user_id", "module_key", name="uq_notification_preferences_user_module"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    module_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    settings_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PushSubscription(TimestampMixin, Base):
    __tablename__ = "push_subscriptions"
    __table_args__ = (UniqueConstraint("user_id", "endpoint", name="uq_push_subscriptions_user_endpoint"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint: Mapped[str] = mapped_column(String(2000), nullable=False)
    p256dh: Mapped[str] = mapped_column(String(2048), nullable=False)
    auth: Mapped[str] = mapped_column(String(512), nullable=False)
    device_label: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class NotificationDeliveryAttempt(Base):
    __tablename__ = "notification_delivery_attempts"
    __table_args__ = (
        Index("uq_notification_delivery_attempt_channel", "notification_id", "channel", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    notification_id: Mapped[int] = mapped_column(ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    error_message: Mapped[str] = mapped_column(String(1000), nullable=False, default="")


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


ALL_MODELS = (
    Household,
    Child,
    User,
    Module,
    HouseholdModuleAccess,
    UserModuleAccess,
    Tag,
    Chore,
    ChoreAllowedChild,
    ChoreRotationMember,
    ChoreRotationState,
    Submission,
    SubmissionItem,
    CompletionRecord,
    Transaction,
    HomeschoolSemester,
    HomeschoolSubject,
    HomeschoolAttendance,
    HomeschoolDayComment,
    HomeschoolGrade,
    QuickTemplate,
    RecipeCategory,
    RecipeTag,
    Recipe,
    RecipeCategoryLink,
    RecipeTagLink,
    RecipeIngredient,
    RecipeStep,
    RecipeStepIngredientLink,
    RecipeComponent,
    Notification,
    NotificationPreference,
    PushSubscription,
    NotificationDeliveryAttempt,
    RecipeFeedback,
)
