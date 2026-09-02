"""Chore submission notification recipient and message orchestration."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.core import Child, Chore, Submission, SubmissionItem, User
from app.models.enums import SubmissionStatus, UserRole
from app.services.notification_creation import create_notification


def notify_submission_created(session: Session, submission: Submission) -> int:
    child = session.get(Child, submission.child_id)
    child_name = child.name if child is not None else "A child"
    item_count = (
        session.scalar(
            select(func.count()).select_from(SubmissionItem).where(SubmissionItem.submission_id == submission.id)
        )
        or 0
    )
    recipients = list(
        session.scalars(
            select(User).where(
                User.household_id == submission.household_id,
                User.role.in_([UserRole.PARENT, UserRole.PARENT_ADMIN]),
            )
        ).all()
    )
    created = 0
    for user in recipients:
        result = create_notification(
            session,
            household_id=submission.household_id,
            user_id=user.id,
            category="approval",
            title="Chore ready for review",
            body=f"{child_name} submitted {item_count} chore{'s' if item_count != 1 else ''} for approval.",
            link_url="/chore/board",
            dedup_key=f"chores:submission:{submission.id}:parent:{user.id}",
            child_id=submission.child_id,
        )
        if result is not None:
            created += 1
    return created


def notify_submission_approved(session: Session, submission: Submission) -> int:
    child_user = session.scalar(
        select(User).where(
            User.household_id == submission.household_id,
            User.child_id == submission.child_id,
            User.role == UserRole.CHILD,
        )
    )
    if child_user is None:
        return 0
    item_rows = list(
        session.scalars(select(SubmissionItem).where(SubmissionItem.submission_id == submission.id)).all()
    )
    chore_ids = [item.chore_id for item in item_rows if item.status == SubmissionStatus.APPROVED]
    names = (
        [row.name for row in session.scalars(select(Chore).where(Chore.id.in_(chore_ids))).all()]
        if chore_ids
        else []
    )
    created = create_notification(
        session,
        household_id=submission.household_id,
        user_id=child_user.id,
        category="approval",
        title="Chore approved",
        body=f"Approved: {', '.join(names) if names else 'your chore submission'}.",
        link_url="/chore/child/today",
        dedup_key=f"chores:submission:{submission.id}:approved:child:{child_user.id}",
        child_id=submission.child_id,
    )
    return 1 if created is not None else 0


__all__ = ["notify_submission_approved", "notify_submission_created"]
