"""Discovery Lab: trusted registry, scoped child lookup, and materialized access."""

from functools import lru_cache
import json
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import Child, User
from app.models.discovery import DiscoveryExplorationAccess
from app.models.enums import UserRole
from app.schemas.discovery import DiscoveryExploration
from pydantic import ValidationError

REGISTRY_PATH = (
    Path(__file__).resolve().parents[4]
    / "packages"
    / "family-api"
    / "discovery-explorations.json"
)


@lru_cache(maxsize=1)
def catalog() -> tuple[dict, ...]:
    try:
        raw = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
        if not isinstance(raw, list) or not raw:
            raise ValueError("Expected a nonempty exploration array.")
        entries = [
            DiscoveryExploration.model_validate(entry).model_dump() for entry in raw
        ]
        if len({entry["id"] for entry in entries}) != len(entries):
            raise ValueError("Exploration IDs must be unique.")
    except (OSError, ValueError, ValidationError) as exc:
        raise RuntimeError(f"Invalid Discovery Lab registry: {exc}") from exc
    return tuple(entries)


def scoped_child(session: Session, user: User, child_id: int) -> Child:
    if user.role == UserRole.CHILD and child_id != user.child_id:
        raise HTTPException(status_code=403, detail="Forbidden.")
    child = session.scalar(
        select(Child).where(
            Child.id == child_id,
            Child.household_id == user.household_id,
            Child.active.is_(True),
        )
    )
    if child is None:
        raise HTTPException(status_code=404, detail="Child not found.")
    return child


def overrides(session: Session, child: Child) -> dict[str, bool]:
    rows = session.scalars(
        select(DiscoveryExplorationAccess).where(
            DiscoveryExplorationAccess.household_id == child.household_id,
            DiscoveryExplorationAccess.child_id == child.id,
        )
    ).all()
    return {row.exploration_id: row.enabled for row in rows}


def matches(
    entry: dict,
    *,
    q: str | None = None,
    subject: str | None = None,
    grade_band: str | None = None,
    tag: str | None = None,
) -> bool:
    searchable = " ".join(
        [entry["title"], entry["summary"], entry["subject"], *entry["tags"]]
    ).casefold()
    return (
        (not q or q.casefold() in searchable)
        and (subject is None or subject == entry["subject"])
        and (grade_band is None or grade_band in entry["grade_bands"])
        and (tag is None or tag in entry["tags"])
    )


def access_response(session: Session, child: Child) -> dict:
    values = overrides(session, child)
    return {
        "child_id": child.id,
        "default_enabled": True,
        "explorations": [
            {
                **entry,
                "enabled": values.get(entry["id"], True),
                "override": values.get(entry["id"]),
            }
            for entry in catalog()
        ],
    }


def set_access(
    session: Session, child: Child, entries: list[dict], enabled: bool
) -> None:
    for entry in entries:
        key = {
            "household_id": child.household_id,
            "child_id": child.id,
            "exploration_id": entry["id"],
        }
        row = session.get(DiscoveryExplorationAccess, key)
        if row is None:
            session.add(DiscoveryExplorationAccess(**key, enabled=enabled))
        else:
            row.enabled = enabled
    session.flush()
