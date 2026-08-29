from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_module_access
from app.models.core import Child, Transaction, User
from app.models.enums import TransactionType, UserRole
from app.modules import MODULE_CHORES
from app.schemas.finance import ChildBalanceResponse, CreateTransactionRequest, TransactionResponse

router = APIRouter(prefix="/finance", tags=["chore-finance"])
_REQUIRE_PARENT = require_module_access(MODULE_CHORES, UserRole.PARENT, UserRole.PARENT_ADMIN)
_REQUIRE_ANY = require_module_access(MODULE_CHORES, UserRole.PARENT, UserRole.PARENT_ADMIN, UserRole.CHILD)


def _child(session: Session, child_id: int, user: User) -> Child:
    child = session.get(Child, child_id)
    if child is None or child.household_id != user.household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")
    if user.role == UserRole.CHILD and user.child_id != child_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
    return child


@router.get("/balances", response_model=list[ChildBalanceResponse])
def balances(session: Session = Depends(get_db_session), user: User = Depends(_REQUIRE_ANY)) -> list[ChildBalanceResponse]:
    stmt = select(Child).where(Child.household_id == user.household_id)
    if user.role == UserRole.CHILD:
        stmt = stmt.where(Child.id == user.child_id)
    children = list(session.scalars(stmt.order_by(Child.name.asc())).all())
    sums = dict(session.execute(select(Transaction.child_id, func.coalesce(func.sum(Transaction.amount_cents), 0)).where(
        Transaction.household_id == user.household_id,
        Transaction.child_id.in_([child.id for child in children]) if children else False,
    ).group_by(Transaction.child_id)).all()) if children else {}
    return [ChildBalanceResponse(child_id=child.id, child_name=child.name, balance_cents=int(sums.get(child.id, 0))) for child in children]


@router.get("/transactions", response_model=list[TransactionResponse])
def transactions(
    child_id: int = Query(gt=0),
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_ANY),
) -> list[TransactionResponse]:
    _child(session, child_id, user)
    return list(session.scalars(select(Transaction).where(
        Transaction.household_id == user.household_id,
        Transaction.child_id == child_id,
    ).order_by(Transaction.created_at.desc(), Transaction.id.desc())).all())


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: CreateTransactionRequest,
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_PARENT),
) -> Transaction:
    _child(session, payload.child_id, user)
    amount = payload.amount_cents
    if payload.type == TransactionType.PAYMENT:
        amount = -abs(amount)
    elif payload.type == TransactionType.BONUS:
        amount = abs(amount)
    transaction = Transaction(
        household_id=user.household_id,
        child_id=payload.child_id,
        amount_cents=amount,
        type=payload.type,
        memo=payload.memo,
        created_by_user_id=user.id,
    )
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction
