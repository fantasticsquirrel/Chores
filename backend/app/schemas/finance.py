from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import TransactionType


class ChildBalanceResponse(BaseModel):
    child_id: int
    child_name: str
    balance_cents: int


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    child_id: int
    amount_cents: int
    type: TransactionType
    memo: str
    created_at: datetime


class CreateTransactionRequest(BaseModel):
    child_id: int = Field(gt=0)
    amount_cents: int = Field(ge=-10_000_000, le=10_000_000)
    type: TransactionType
    memo: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def validate_manual_transaction(self) -> "CreateTransactionRequest":
        if self.type == TransactionType.CHORE_APPROVAL:
            raise ValueError("Chore approval transactions are created by the approval workflow.")
        if self.amount_cents == 0:
            raise ValueError("Transaction amount cannot be zero.")
        return self
