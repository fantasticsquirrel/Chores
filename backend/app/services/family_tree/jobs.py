"""Actor-scoped expiring previews and transfer state; all reads reauthorize."""
from datetime import UTC, datetime, timedelta
import secrets
from sqlalchemy import select, update, func
from app.models.family_tree import FamilyTreeTransferJob as Job
from .access import authorize, collection, error
from .observability import emit, warning_events


def utc(value):
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def revision(session, actor, expected):
    c = collection(session, actor.household_id)
    if (c.revision if c else 0) != expected:
        error('revision_conflict', 'Refresh before requesting a preview.')
    return c


def create(session, actor, kind, expected, payload, summary, seconds=86400):
    authorize(session, actor, manage=True)
    # Per-household/actor staging quotas bound retained sensitive payloads.
    count = session.scalar(select(func.count()).select_from(Job).where(Job.household_id==actor.household_id, Job.actor_user_id==actor.id, Job.state=='ready', Job.expires_at>datetime.now(UTC))) or 0
    if count >= 20:
        error('resource_limit', 'Too many pending transfer or preview jobs.', 413,
              event_fields={'household_id':actor.household_id,'count':count,'limit':20})
    c = revision(session, actor, expected)
    row = Job(household_id=actor.household_id, collection_id=c.id if c else None, actor_user_id=actor.id,
        token=secrets.token_hex(32), kind=kind, state='ready', expected_revision=expected, payload=payload,
        summary=summary, expires_at=datetime.now(UTC)+timedelta(seconds=seconds))
    session.add(row); session.flush()
    warning_events(summary.get('warnings',[]), operation=kind, household_id=actor.household_id, job_id=row.id)
    return row


def get(session, actor, kind, job_id=None, token=None, allow_committed=False):
    authorize(session, actor, manage=True)
    where = [Job.household_id==actor.household_id, Job.actor_user_id==actor.id, Job.kind==kind]
    where.append(Job.id==job_id if job_id is not None else Job.token==token)
    row = session.scalar(select(Job).where(*where).execution_options(populate_existing=True))
    if row is None:
        from fastapi import HTTPException
        raise HTTPException(404, 'Not found.')
    if row.state=='committed' and allow_committed: return row
    if utc(row.expires_at)<=datetime.now(UTC) or row.state!='ready':
        emit('staging_expired', code='transfer_expired', operation=kind, household_id=actor.household_id, job_id=row.id)
        error('transfer_expired', 'This job expired or is no longer available. Start a new preview.')
    return row


def dto(row, preview=False):
    result = {'id':row.id,'kind':row.kind,'state':row.state,'expected_graph_revision':row.expected_revision,
        'expires_at':utc(row.expires_at).isoformat(),'summary':row.summary}
    if preview: result['preview_token']=row.token
    return result


def consume(row):
    row.state='committed'
    # Sensitive snapshots/decisions are not long-term receipts.
    row.payload={}
