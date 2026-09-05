"""Household-scoped homeschool day-comment CRUD operations."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.homeschool import HomeschoolDayComment
from app.schemas.homeschool import UpsertHomeschoolDayCommentRequest
from app.services.homeschool.access import get_household_child_or_404


def list_household_day_comments(
    session: Session,
    household_id: int,
    child_id: int | None = None,
) -> list[HomeschoolDayComment]:
    stmt = select(HomeschoolDayComment).where(HomeschoolDayComment.household_id == household_id)
    if child_id is not None:
        get_household_child_or_404(session, child_id, household_id)
        stmt = stmt.where(HomeschoolDayComment.child_id == child_id)
    return list(session.scalars(stmt.order_by(HomeschoolDayComment.date.desc(), HomeschoolDayComment.id.desc())))


def upsert_household_day_comment(
    session: Session,
    payload: UpsertHomeschoolDayCommentRequest,
) -> HomeschoolDayComment:
    get_household_child_or_404(session, payload.child_id, payload.household_id)
    comment = session.scalar(
        select(HomeschoolDayComment).where(
            HomeschoolDayComment.household_id == payload.household_id,
            HomeschoolDayComment.child_id == payload.child_id,
            HomeschoolDayComment.date == payload.date,
        )
    )
    if comment is None:
        comment = HomeschoolDayComment(**payload.model_dump())
        session.add(comment)
    else:
        comment.comment = payload.comment
    return comment


def delete_household_day_comment(session: Session, comment_id: int, household_id: int) -> None:
    comment = session.scalar(
        select(HomeschoolDayComment).where(
            HomeschoolDayComment.id == comment_id,
            HomeschoolDayComment.household_id == household_id,
        )
    )
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Day comment not found.")
    session.delete(comment)
