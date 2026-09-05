"""Support-case lookup, mutation, and response serialization."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.identity import Household
from app.models.platform import SupportCase, SupportCaseNote
from app.services.ops.platform_users import redacted_platform_user_email


def list_household_support_cases(
    session: Session,
    household_id: int,
) -> list[SupportCase]:
    return list(
        session.scalars(
            select(SupportCase)
            .where(SupportCase.household_id == household_id)
            .order_by(SupportCase.id.desc())
        )
    )


def list_support_case_notes(
    session: Session,
    case_id: int,
) -> list[SupportCaseNote]:
    return list(
        session.scalars(
            select(SupportCaseNote)
            .where(SupportCaseNote.case_id == case_id)
            .order_by(SupportCaseNote.id)
        )
    )


def create_support_case(
    session: Session,
    *,
    household_id: int,
    opened_by_platform_user_id: int,
    reason: str,
) -> SupportCase:
    household_exists = session.scalar(
        select(Household.id).where(Household.id == household_id)
    )
    if household_exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Household not found.",
        )
    case = SupportCase(
        household_id=household_id,
        opened_by_platform_user_id=opened_by_platform_user_id,
        reason=reason,
        status="open",
    )
    session.add(case)
    session.flush()
    return case


def get_support_case_or_404(session: Session, case_id: int) -> SupportCase:
    case = session.scalar(select(SupportCase).where(SupportCase.id == case_id))
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Support case not found.",
        )
    return case


def get_open_household_support_case_or_403(
    session: Session,
    *,
    case_id: int,
    household_id: int,
) -> SupportCase:
    case = session.scalar(
        select(SupportCase).where(
            SupportCase.id == case_id,
            SupportCase.household_id == household_id,
            SupportCase.status == "open",
        )
    )
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An open support case for this household is required.",
        )
    return case


def add_support_case_note(
    session: Session,
    *,
    case_id: int,
    author_platform_user_id: int,
    body: str,
) -> tuple[SupportCase, SupportCaseNote]:
    case = get_support_case_or_404(session, case_id)
    note = SupportCaseNote(
        case_id=case.id,
        author_platform_user_id=author_platform_user_id,
        body=body,
    )
    session.add(note)
    session.flush()
    return case, note


def support_case_dict(
    session: Session,
    case: SupportCase,
    *,
    include_household_id: bool = True,
    notes: list[SupportCaseNote] | None = None,
) -> dict[str, object]:
    case_notes = notes if notes is not None else list_support_case_notes(session, case.id)
    data: dict[str, object] = {"id": case.id}
    if include_household_id:
        data["household_id"] = case.household_id
    data.update(
        {
            "subject": case.reason,
            "status": case.status,
            "created_at": case.created_at,
            "notes": [
                support_case_note_dict(session, note)
                for note in case_notes
            ],
        }
    )
    return data


def support_case_note_dict(
    session: Session,
    note: SupportCaseNote,
) -> dict[str, object]:
    return {
        "id": note.id,
        "case_id": note.case_id,
        "author_email": redacted_platform_user_email(
            session,
            note.author_platform_user_id,
        ),
        "body": note.body,
        "created_at": note.created_at,
    }
