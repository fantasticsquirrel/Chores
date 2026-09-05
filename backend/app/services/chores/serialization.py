"""Response serialization for managed chores."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.chores import Chore, ChoreAllowedChild, ChoreRotationMember
from app.schemas.chores import ChoreResponse


def serialize_chore(session: Session, chore: Chore) -> ChoreResponse:
    allowed_child_ids = list(
        session.scalars(
            select(ChoreAllowedChild.child_id).where(ChoreAllowedChild.chore_id == chore.id)
        ).all()
    )
    rotation_order = list(
        session.scalars(
            select(ChoreRotationMember.child_id)
            .where(ChoreRotationMember.chore_id == chore.id)
            .order_by(ChoreRotationMember.position.asc())
        ).all()
    )
    response = ChoreResponse.model_validate(chore)
    response.allowed_child_ids = allowed_child_ids
    response.rotation_order = rotation_order
    return response


__all__ = ["serialize_chore"]
