"""Narrow owner-console contracts; never expose identity credential fields."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StrictBool, StringConstraints


class ModuleChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: StrictBool
    expected_enabled: StrictBool
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=1000)]


class OwnerOverview(BaseModel):
    household_count: int
    account_count: int
    active_account_count: int
    enabled_module_count: int
    module_count: int


class OwnerHousehold(BaseModel):
    id: int
    name: str
    owner_email: str
    billing_status: str
    timezone: str
    account_count: int
    active_account_count: int


class OwnerHouseholds(BaseModel):
    items: list[OwnerHousehold]
    total: int
    offset: int
    limit: int


class GlobalModule(BaseModel):
    key: str
    name: str
    description: str
    enabled: bool
    can_enable: bool
    can_disable: bool
    restriction: str | None
    platforms: dict[Literal["web", "mobile"], bool]


class HouseholdModule(BaseModel):
    key: str
    name: str
    description: str
    enabled: bool
    globally_enabled: bool
    effective_enabled: bool
    can_enable: bool
    can_disable: bool
    restriction: str | None


class OwnerAccount(BaseModel):
    id: int
    email: str
    role: Literal["PARENT_ADMIN", "PARENT", "CHILD"]
    active: bool
    is_household_owner: bool


class OwnerAccounts(BaseModel):
    household_id: int
    items: list[OwnerAccount]
    total: int
    offset: int
    limit: int
