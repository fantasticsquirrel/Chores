from __future__ import annotations

from enum import Enum


class UserRole(str, Enum):
    PARENT_ADMIN = "PARENT_ADMIN"
    PARENT = "PARENT"
    CHILD = "CHILD"


class PlatformRole(str, Enum):
    OWNER = "OWNER"
    SUPPORT = "SUPPORT"


class EntitlementStatus(str, Enum):
    NONE = "none"
    TRIALING = "trialing"
    ACTIVE = "active"
    GRACE = "grace"
    CANCELED_ACTIVE = "canceled-active"
    EXPIRED = "expired"
    REFUNDED = "refunded"
    REVOKED = "revoked"
    COMPLIMENTARY = "complimentary"


class ScheduleMode(str, Enum):
    NONE = "NONE"
    EVERY = "EVERY"
    AFTER_COMPLETION = "AFTER_COMPLETION"
    ONCE = "ONCE"


class ScheduleUnit(str, Enum):
    DAY = "DAY"
    WEEK = "WEEK"
    MONTH = "MONTH"


class CompletionMode(str, Enum):
    PER_CHILD = "PER_CHILD"
    SHARED = "SHARED"


class AssignmentMode(str, Enum):
    STATIC = "STATIC"
    ROTATING = "ROTATING"


class SubmissionStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class CompletionStatus(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class TransactionType(str, Enum):
    CHORE_APPROVAL = "CHORE_APPROVAL"
    BONUS = "BONUS"
    PAYMENT = "PAYMENT"
    ADJUSTMENT = "ADJUSTMENT"
