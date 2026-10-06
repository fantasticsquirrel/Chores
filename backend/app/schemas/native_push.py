"""No caller identity, URL, or provider credentials cross this contract."""
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TOKEN_PATTERN = re.compile(r"(?:ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{1,200}\]", re.ASCII)


class NativePushSubscriptionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=1, max_length=224, strict=True, repr=False)
    platform: Literal["android", "ios"]

    @field_validator("token")
    @classmethod
    def validate_token(cls, token: str) -> str:
        if not TOKEN_PATTERN.fullmatch(token):
            raise ValueError("Invalid native push token.")
        return token


class NativePushSubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    platform: Literal["android", "ios"]
    enabled: bool


class NativePushSubscriptionList(BaseModel):
    items: list[NativePushSubscriptionResponse]


class NativePushConfigResponse(BaseModel):
    enabled: bool
