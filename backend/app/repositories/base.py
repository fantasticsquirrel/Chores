from __future__ import annotations

from sqlalchemy.orm import Session


class SQLAlchemyRepository:
    """Base repository that provides a shared SQLAlchemy session."""

    def __init__(self, session: Session) -> None:
        self.session = session
