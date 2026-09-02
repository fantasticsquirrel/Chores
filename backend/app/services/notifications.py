"""Stable compatibility facade for notification capabilities."""

from app.services.notification_creation import create_notification, utc_now
from app.services.notification_preferences import (
    DEFAULT_CHORE_NOTIFICATION_SETTINGS,
    MODULE_CHORES,
    get_user_notification_settings,
    update_user_notification_settings,
)
from app.services.notification_push import (
    MAX_PUSH_ATTEMPTS,
    PUSH_TIMEOUT_SECONDS,
    enqueue_push_delivery_attempts,
    process_pending_push_deliveries,
)
from app.services.notification_reminders import generate_daily_chore_reminders, run_notification_scheduler
from app.services.notification_submissions import notify_submission_approved, notify_submission_created
from app.services.push_subscriptions import disable_push_subscriptions, upsert_push_subscription

__all__ = [
    "DEFAULT_CHORE_NOTIFICATION_SETTINGS",
    "MAX_PUSH_ATTEMPTS",
    "MODULE_CHORES",
    "PUSH_TIMEOUT_SECONDS",
    "create_notification",
    "disable_push_subscriptions",
    "enqueue_push_delivery_attempts",
    "generate_daily_chore_reminders",
    "get_user_notification_settings",
    "notify_submission_approved",
    "notify_submission_created",
    "process_pending_push_deliveries",
    "run_notification_scheduler",
    "update_user_notification_settings",
    "upsert_push_subscription",
    "utc_now",
]
