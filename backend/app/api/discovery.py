from app.models.discovery import DiscoveryPackageVersion
from app.schemas.discovery_packages import PackageUpload
from app.services.discovery.packages import (
    validate_archive,
    store_package,
    version_row,
    summary,
    publish,
)
import json
from sqlalchemy.exc import IntegrityError

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.dependencies import (
    get_db_session,
    require_module_view,
    require_module_manage,
)
from app.models import Child, User
from app.models.enums import UserRole
from app.schemas.discovery import (
    DiscoveryExploration,
    DiscoveryChildAccessResponse,
    DiscoveryChildResponse,
)
from app.security.audit import audit
from app.services.discovery import (
    access_response,
    household_catalog,
    matches,
    overrides,
    scoped_child,
    set_access,
)

router = APIRouter(prefix="/discovery", tags=["discovery-lab"])
_view = require_module_view(
    "discovery-lab", UserRole.PARENT_ADMIN, UserRole.PARENT, UserRole.CHILD
)
_parent_view = require_module_view(
    "discovery-lab", UserRole.PARENT_ADMIN, UserRole.PARENT
)
_manage = require_module_manage("discovery-lab", UserRole.PARENT_ADMIN, UserRole.PARENT)
ChildId = Annotated[int, Path(gt=0)]


class DiscoveryAccessUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    enabled: StrictBool
    package_versions: dict[
        Annotated[str, Field(max_length=80)], Annotated[str, Field(max_length=60)]
    ] = Field(default_factory=dict, max_length=200)
    exploration_ids: list[str] | None = Field(
        default=None, min_length=1, max_length=200
    )
    subject: str | None = Field(default=None, min_length=1, max_length=100)
    grade_band: str | None = Field(default=None, min_length=1, max_length=100)
    tag: str | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def require_selection(self):
        if (
            self.exploration_ids is None
            and self.subject is None
            and self.grade_band is None
            and self.tag is None
        ):
            raise ValueError("Choose at least one exploration or filter.")
        if self.exploration_ids is not None and (
            len(set(self.exploration_ids)) != len(self.exploration_ids)
            or any(len(item) > 80 for item in self.exploration_ids)
        ):
            raise ValueError("Exploration IDs must be unique and valid.")
        return self


@router.get(
    "/explorations",
    response_model=list[DiscoveryExploration],
    response_model_exclude_unset=True,
)
def list_explorations(
    child_id: int | None = Query(default=None, gt=0),
    q: str | None = Query(default=None, max_length=100),
    subject: str | None = Query(default=None, max_length=100),
    grade_band: str | None = Query(default=None, max_length=100),
    tag: str | None = Query(default=None, max_length=100),
    user: User = Depends(_view),
    session: Session = Depends(get_db_session),
):
    if user.role == UserRole.CHILD and user.child_id is None:
        raise HTTPException(status_code=403, detail="Forbidden.")
    target = (
        user.child_id if user.role == UserRole.CHILD and child_id is None else child_id
    )
    values = (
        overrides(session, scoped_child(session, user, target))
        if target is not None
        else {}
    )
    return [
        entry
        for entry in household_catalog(session, user.household_id)
        if values.get(entry["id"], True)
        and matches(entry, q=q, subject=subject, grade_band=grade_band, tag=tag)
    ]


@router.get(
    "/explorations/{exploration_id}",
    response_model=DiscoveryExploration,
    response_model_exclude_unset=True,
)
def get_exploration(
    exploration_id: str = Path(min_length=1, max_length=80),
    child_id: int | None = Query(default=None, gt=0),
    user: User = Depends(_view),
    session: Session = Depends(get_db_session),
):
    if user.role == UserRole.CHILD and user.child_id is None:
        raise HTTPException(status_code=403, detail="Forbidden.")
    target = (
        user.child_id if user.role == UserRole.CHILD and child_id is None else child_id
    )
    values = (
        overrides(session, scoped_child(session, user, target))
        if target is not None
        else {}
    )
    entry = next(
        (
            entry
            for entry in household_catalog(session, user.household_id)
            if entry["id"] == exploration_id
        ),
        None,
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Exploration not found.")
    if not values.get(exploration_id, True):
        raise HTTPException(
            status_code=403, detail="This exploration is not enabled for this child."
        )
    return entry


@router.get("/children", response_model=list[DiscoveryChildResponse])
def list_children(
    user: User = Depends(_parent_view), session: Session = Depends(get_db_session)
):
    return [
        {"id": child.id, "name": child.name, "active": child.active}
        for child in session.scalars(
            select(Child)
            .where(Child.household_id == user.household_id, Child.active.is_(True))
            .order_by(Child.name, Child.id)
        )
    ]


@router.get(
    "/children/{child_id}/access",
    response_model=DiscoveryChildAccessResponse,
    response_model_exclude_unset=True,
)
def get_access(
    child_id: ChildId,
    user: User = Depends(_parent_view),
    session: Session = Depends(get_db_session),
):
    return access_response(session, scoped_child(session, user, child_id))


@router.put(
    "/children/{child_id}/access",
    response_model=DiscoveryChildAccessResponse,
    response_model_exclude_unset=True,
)
def update_access(
    child_id: ChildId,
    payload: DiscoveryAccessUpdate,
    request: Request,
    user: User = Depends(_manage),
    session: Session = Depends(get_db_session),
):
    child = scoped_child(session, user, child_id)
    ids = set(payload.exploration_ids) if payload.exploration_ids is not None else None
    if ids is not None and not ids.issubset(
        {entry["id"] for entry in household_catalog(session, user.household_id)}
    ):
        raise HTTPException(status_code=422, detail="Unknown exploration ID.")
    selected = [
        entry
        for entry in household_catalog(session, user.household_id)
        if (ids is None or entry["id"] in ids)
        and matches(
            entry,
            subject=payload.subject,
            grade_band=payload.grade_band,
            tag=payload.tag,
        )
    ]
    if not selected:
        raise HTTPException(
            status_code=422, detail="No explorations match the selection."
        )
    if payload.enabled:
        for entry in selected:
            if (
                entry.get("package")
                and payload.package_versions.get(entry["id"])
                != entry["package"]["version"]
            ):
                raise HTTPException(
                    status_code=409,
                    detail="Review the current package version before enabling it for a child.",
                )
    set_access(session, child, selected, payload.enabled)
    audit(
        session,
        "discovery.access.updated",
        request=request,
        actor=user,
        details={
            "child_id": child.id,
            "exploration_ids": [entry["id"] for entry in selected],
            "enabled": payload.enabled,
        },
    )
    session.commit()
    return access_response(session, child)


# Package management stays behind both the role and module-manage boundary.


@router.get("/packages")
def list_packages(
    user: User = Depends(_manage), session: Session = Depends(get_db_session)
):
    return [
        summary(session, row)
        for row in session.scalars(
            select(DiscoveryPackageVersion)
            .where(DiscoveryPackageVersion.household_id == user.household_id)
            .order_by(
                DiscoveryPackageVersion.package_id,
                DiscoveryPackageVersion.created_at.desc(),
            )
        )
    ]


@router.post("/packages", status_code=201)
def upload_package(
    payload: PackageUpload,
    request: Request,
    user: User = Depends(_manage),
    session: Session = Depends(get_db_session),
):
    content = validate_archive(payload.archive_base64)
    try:
        row = store_package(session, user.household_id, content)
        audit(
            session,
            "discovery.package.uploaded",
            request=request,
            actor=user,
            details={
                "package_id": row.package_id,
                "version": row.version,
                "checksum": row.checksum,
            },
        )
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=409, detail="Package version already exists."
        ) from exc
    return summary(session, row)


@router.get("/packages/{package_id}/versions/{version}")
def preview_package(
    response: Response,
    package_id: str = Path(min_length=1, max_length=80),
    version: str = Path(min_length=1, max_length=60),
    user: User = Depends(_manage),
    session: Session = Depends(get_db_session),
):
    row = version_row(session, user.household_id, package_id, version)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return json.loads(row.payload_json)


@router.post("/packages/{package_id}/versions/{version}/publish")
def publish_package(
    request: Request,
    package_id: str = Path(min_length=1, max_length=80),
    version: str = Path(min_length=1, max_length=60),
    user: User = Depends(_manage),
    session: Session = Depends(get_db_session),
):
    row = version_row(session, user.household_id, package_id, version)
    publish(session, row)
    audit(
        session,
        "discovery.package.published",
        request=request,
        actor=user,
        details={
            "package_id": row.package_id,
            "version": row.version,
            "checksum": row.checksum,
        },
    )
    session.commit()
    return summary(session, row)


@router.get("/explorations/{exploration_id}/package")
def get_exploration_package(
    response: Response,
    exploration_id: str = Path(min_length=1, max_length=80),
    child_id: int | None = Query(default=None, gt=0),
    user: User = Depends(_view),
    session: Session = Depends(get_db_session),
):
    entry = get_exploration(
        exploration_id=exploration_id, child_id=child_id, user=user, session=session
    )
    if not entry.get("package"):
        raise HTTPException(status_code=404, detail="Package not found.")
    row = version_row(
        session, user.household_id, exploration_id, entry["package"]["version"]
    )
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return json.loads(row.payload_json)
