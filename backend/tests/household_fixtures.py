"""Valid legacy fixture households without weakening production ownership.

Fixture actors remain separate from the required owner, so tests of actor
inactivation/movement still exercise their intended non-owner behavior.
"""
from sqlalchemy import select, func
from app.models import Household, User
from app.models.enums import UserRole


def household_with_owner(session, **values):
    household_id = (session.scalar(select(func.max(Household.id))) or 0) + 1
    pending = [obj.id for obj in session.new if isinstance(obj, Household) and obj.id is not None]
    household_id = max([household_id, *(value + 1 for value in pending)])
    owner_id = (session.scalar(select(func.max(User.id))) or 0) + 1
    pending_users = [obj.id for obj in session.new if isinstance(obj, User) and obj.id is not None]
    owner_id = max([owner_id, *(value + 1 for value in pending_users)])
    household = Household(id=household_id, owner_user_id=owner_id, **values)
    owner = User(id=owner_id, household_id=household_id, email=f'fixture-owner-{household_id}@example.test', password_hash='fixture-owner-not-login-enabled', role=UserRole.PARENT, active=True)
    # The same deferred FK used by registration permits this circular pair.
    session.add(household)
    session.flush()
    session.add(owner)
    session.flush()
    return household
