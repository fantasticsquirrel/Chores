from __future__ import annotations

from datetime import UTC, datetime
import hashlib
import hmac
import json
import threading

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_module_access
from app.config import get_settings
from app.models.core import User
from app.models.enums import UserRole
from app.models.support import SupportTicketLink, SupportWebhookReceipt
from app.modules import MODULE_SUPPORT
from app.schemas.support import SupportStatusResponse, SupportTicketCreate, SupportTicketReply, SupportTicketResponse
from app.services.zammad import ZammadClient, ZammadUnavailable

router = APIRouter(prefix="/support", tags=["support"])
integration_router = APIRouter(prefix="/integrations/zammad", tags=["integrations"])
_require_support = require_module_access(MODULE_SUPPORT, UserRole.PARENT, UserRole.PARENT_ADMIN)
_create_locks: dict[tuple[int, str], threading.Lock] = {}
_create_locks_guard = threading.Lock()


def _create_lock(household_id: int, key: str) -> threading.Lock:
    with _create_locks_guard:
        return _create_locks.setdefault((household_id, key), threading.Lock())


def _client() -> ZammadClient:
    settings = get_settings()
    if not settings.zammad_enabled:
        raise HTTPException(status_code=503, detail="Support tickets are not enabled yet.")
    return ZammadClient(settings)


def _response(link: SupportTicketLink, articles: list[dict[str, object]] | None = None) -> SupportTicketResponse:
    return SupportTicketResponse(id=link.id, ticket_number=link.ticket_number, title=link.title, state=link.state, created_at=link.created_at, updated_at=link.updated_at, articles=articles or [])


def _owned_link(session: Session, link_id: int, user: User) -> SupportTicketLink:
    link = session.scalar(select(SupportTicketLink).where(SupportTicketLink.id == link_id, SupportTicketLink.household_id == user.household_id))
    if link is None:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    return link


@router.get("/status", response_model=SupportStatusResponse)
def support_status(user: User = Depends(_require_support)) -> SupportStatusResponse:
    _ = user
    return SupportStatusResponse(enabled=get_settings().zammad_enabled)


@router.get("/tickets", response_model=list[SupportTicketResponse])
def list_tickets(session: Session = Depends(get_db_session), user: User = Depends(_require_support)) -> list[SupportTicketResponse]:
    rows = session.scalars(select(SupportTicketLink).where(SupportTicketLink.household_id == user.household_id).order_by(SupportTicketLink.updated_at.desc())).all()
    return [_response(row) for row in rows]


@router.post("/tickets", response_model=SupportTicketResponse, status_code=201)
def create_ticket(payload: SupportTicketCreate, session: Session = Depends(get_db_session), user: User = Depends(_require_support)) -> SupportTicketResponse:
    with _create_lock(user.household_id, payload.idempotency_key):
        existing = session.scalar(select(SupportTicketLink).where(SupportTicketLink.household_id == user.household_id, SupportTicketLink.idempotency_key == payload.idempotency_key))
        if existing is not None:
            return _response(existing)
        try:
            remote = _client().create_ticket(title=payload.title, body=payload.body, customer_email=user.email, fields={
                "fm_household_id": str(user.household_id), "fm_user_id": str(user.id), "fm_category": payload.category,
                "fm_environment": payload.environment, "fm_app_version": payload.app_version, "fm_correlation_id": payload.idempotency_key,
            })
        except ZammadUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        now = datetime.now(UTC)
        link = SupportTicketLink(household_id=user.household_id, user_id=user.id, zammad_ticket_id=int(remote["id"]), ticket_number=str(remote.get("number", remote["id"])), title=payload.title, state=str(remote.get("state", "new")), idempotency_key=payload.idempotency_key, updated_at=now)
        session.add(link)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            existing = session.scalar(select(SupportTicketLink).where(SupportTicketLink.household_id == user.household_id, SupportTicketLink.idempotency_key == payload.idempotency_key))
            if existing is None:
                raise
            return _response(existing)
        return _response(link)


@router.get("/tickets/{link_id}", response_model=SupportTicketResponse)
def get_ticket(link_id: int, session: Session = Depends(get_db_session), user: User = Depends(_require_support)) -> SupportTicketResponse:
    link = _owned_link(session, link_id, user)
    try:
        remote = _client().get_ticket(link.zammad_ticket_id)
        articles = _client().get_articles(link.zammad_ticket_id)
    except ZammadUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    link.state = str(remote.get("state", link.state))
    link.updated_at = datetime.now(UTC)
    session.commit()
    safe_articles = [{k: row.get(k) for k in ("id", "body", "created_at", "sender", "type")} for row in articles if not row.get("internal", False)]
    return _response(link, safe_articles)


@router.post("/tickets/{link_id}/replies", response_model=SupportTicketResponse)
def reply_ticket(link_id: int, payload: SupportTicketReply, session: Session = Depends(get_db_session), user: User = Depends(_require_support)) -> SupportTicketResponse:
    link = _owned_link(session, link_id, user)
    try:
        _client().reply(link.zammad_ticket_id, payload.body)
    except ZammadUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    link.updated_at = datetime.now(UTC)
    session.commit()
    return _response(link)


@router.post("/reconcile", response_model=list[SupportTicketResponse])
def reconcile(session: Session = Depends(get_db_session), user: User = Depends(_require_support)) -> list[SupportTicketResponse]:
    if user.role != UserRole.PARENT_ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden.")
    client = _client()
    rows = session.scalars(select(SupportTicketLink).where(SupportTicketLink.household_id == user.household_id)).all()
    try:
        for link in rows:
            remote = client.get_ticket(link.zammad_ticket_id)
            link.state = str(remote.get("state", link.state))
            link.updated_at = datetime.now(UTC)
    except ZammadUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    session.commit()
    return [_response(row) for row in rows]


@integration_router.post("/webhook", status_code=status.HTTP_204_NO_CONTENT)
async def webhook(request: Request, session: Session = Depends(get_db_session), x_zammad_timestamp: str = Header(alias="X-Zammad-Timestamp"), x_zammad_signature: str = Header(alias="X-Zammad-Signature")) -> None:
    settings = get_settings()
    if not settings.zammad_enabled:
        raise HTTPException(status_code=404, detail="Not found.")
    try:
        timestamp = int(x_zammad_timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid signature.") from exc
    now = int(datetime.now(UTC).timestamp())
    if abs(now - timestamp) > settings.zammad_webhook_max_age_seconds:
        raise HTTPException(status_code=401, detail="Invalid signature.")
    body = await request.body()
    expected = hmac.new(settings.zammad_webhook_secret.encode(), x_zammad_timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    supplied = x_zammad_signature.removeprefix("sha256=")
    if not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=401, detail="Invalid signature.")
    digest = hashlib.sha256(x_zammad_timestamp.encode() + b"." + body).hexdigest()
    if session.get(SupportWebhookReceipt, digest) is not None:
        return
    try:
        payload = json.loads(body)
        ticket = payload.get("ticket", payload)
        ticket_id = int(ticket["id"])
    except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload.") from exc
    link = session.scalar(select(SupportTicketLink).where(SupportTicketLink.zammad_ticket_id == ticket_id))
    if link is not None:
        link.state = str(ticket.get("state", link.state))
        link.updated_at = datetime.now(UTC)
    session.add(SupportWebhookReceipt(event_digest=digest, zammad_ticket_id=ticket_id))
    session.commit()
