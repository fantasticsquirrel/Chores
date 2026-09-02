"""Public submission approval and review boundary."""

from app.models.core import SubmissionItem
from app.models.enums import SubmissionStatus

from app.services.chores.workflow import (
    approval_occurrence_or_409,
    record_approved_occurrence,
    serialize_submission_review,
)


def derive_submission_status(items: list[SubmissionItem]) -> SubmissionStatus:
    if any(item.status == SubmissionStatus.PENDING for item in items):
        return SubmissionStatus.PENDING
    if any(item.status == SubmissionStatus.APPROVED for item in items):
        return SubmissionStatus.APPROVED
    return SubmissionStatus.REJECTED

__all__ = [
    "approval_occurrence_or_409",
    "derive_submission_status",
    "record_approved_occurrence",
    "serialize_submission_review",
]
