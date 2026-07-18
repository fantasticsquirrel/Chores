from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class OwnershipResponse(BaseModel):
    household_id: int
    owner_user_id: int


class OwnershipTransferRequest(BaseModel):
    new_owner_user_id: int = Field(gt=0)
    current_password: str = Field(min_length=1, max_length=1024)
    confirmation: Literal["TRANSFER OWNERSHIP"]
