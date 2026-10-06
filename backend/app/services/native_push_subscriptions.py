"""Registration persistence and session lifecycle checks, without network I/O."""
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import AuthSession, NativePushSubscription, User


class NativePushConflict(ValueError):
    pass


def db_time(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None) if value.tzinfo else value


def bound_session_valid(session: Session, auth: AuthSession | None, user: User, now: datetime) -> bool:
    return bool(
        auth is not None
        and auth.user_id == user.id
        and auth.revoked_at is None
        and auth.session_generation == user.session_generation
        and db_time(auth.expires_at) > db_time(now)
    )


def register_native_subscription(
    session: Session, *, user: User, auth: AuthSession, token: str, platform: str
) -> NativePushSubscription:
    now = datetime.now(UTC)
    row = session.scalar(select(NativePushSubscription).where(NativePushSubscription.token == token).with_for_update())
    if row is None:
        row = NativePushSubscription(user_id=user.id, household_id=user.household_id, session_id=auth.id,
                                     token=token, platform=platform, enabled=True, last_seen_at=now)
        session.add(row)
        session.flush()
        return row
    if row.session_id != auth.id or row.user_id != user.id:
        former_auth = session.get(AuthSession, row.session_id)
        former_user = session.get(User, row.user_id)
        if former_user is not None and bound_session_valid(session, former_auth, former_user, now):
            raise NativePushConflict("Native push token already registered.")
        # The previous binding is a compare-and-swap boundary even on SQLite,
        # where SELECT FOR UPDATE has no effect.
        result = session.execute(update(NativePushSubscription).where(
            NativePushSubscription.id == row.id,
            NativePushSubscription.session_id == row.session_id,
            NativePushSubscription.user_id == row.user_id,
        ).values(user_id=user.id, household_id=user.household_id, session_id=auth.id,
                 platform=platform, enabled=True, last_seen_at=now, disabled_at=None),
            execution_options={"synchronize_session": False})
        if result.rowcount != 1:
            raise NativePushConflict("Native push token already registered.")
        session.refresh(row)
    else:
        row.platform = platform
        row.household_id = user.household_id
        row.enabled = True
        row.disabled_at = None
        row.last_seen_at = now
        session.flush()
    return row
