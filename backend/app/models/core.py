"""Compatibility exports for the former monolithic core model module.

New code should import models from their domain module.  This shim remains
temporarily so model moves can land without mixing in a repository-wide import
rewrite.
"""

from app.models.chores import (
    Chore,
    ChoreAllowedChild,
    ChoreRotationMember,
    ChoreRotationState,
    CompletionRecord,
    ParentChoreCompletion,
    Submission,
    SubmissionItem,
    Tag,
    Transaction,
)
from app.models.homeschool import (
    HomeschoolAttendance,
    HomeschoolDayComment,
    HomeschoolGrade,
    HomeschoolSemester,
    HomeschoolSubject,
)
from app.models.identity import AuthSession, Child, Household, LoginAttempt, SecurityAuditEvent, User
from app.models.modules import HouseholdModuleAccess, Module, UserModuleAccess
from app.models.notifications import Notification, NotificationDeliveryAttempt, NotificationPreference, PushSubscription
from app.models.recipes import (
    QuickTemplate,
    Recipe,
    RecipeCategory,
    RecipeCategoryLink,
    RecipeComponent,
    RecipeFeedback,
    RecipeIngredient,
    RecipeStep,
    RecipeStepIngredientLink,
    RecipeTag,
    RecipeTagLink,
)
from app.models.recovery import (
    AccountRegistration,
    AccountRegistrationDelivery,
    PasswordReset,
    PasswordResetDelivery,
    PasswordResetRequest,
)

ALL_MODELS = (
    Household,
    Child,
    User,
    AuthSession,
    LoginAttempt,
    SecurityAuditEvent,
    PasswordReset,
    PasswordResetRequest,
    PasswordResetDelivery,
    AccountRegistration,
    AccountRegistrationDelivery,
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
    ParentChoreCompletion,
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

__all__ = [model.__name__ for model in ALL_MODELS] + ["ALL_MODELS"]
