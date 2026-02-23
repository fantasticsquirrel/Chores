from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import SubmissionStatus


class EligibleChoreResponse(BaseModel):
    chore_id: int
    name: str
    reward_cents: int
    occurrence_date: date
    expires_on: date | None = None


class CreateSubmissionRequest(BaseModel):
    for_date: date
    chore_ids: list[int] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_unique_chore_ids(self) -> "CreateSubmissionRequest":
        if len(self.chore_ids) != len(set(self.chore_ids)):
            raise ValueError("chore_ids must not contain duplicates.")
        return self


class SubmissionItemResponse(BaseModel):
    chore_id: int
    status: SubmissionStatus


class SubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    child_id: int
    for_date: date
    status: SubmissionStatus
    items: list[SubmissionItemResponse]


class SubmissionReviewItemResponse(BaseModel):
    id: int
    chore_id: int
    chore_name: str
    chore_reward_cents: int
    status: SubmissionStatus


class SubmissionReviewResponse(BaseModel):
    id: int
    child_id: int
    child_name: str
    for_date: date
    status: SubmissionStatus
    items: list[SubmissionReviewItemResponse]


class SubmissionItemDecisionRequest(BaseModel):
    status: SubmissionStatus

    @model_validator(mode="after")
    def validate_submission_item_decision_status(self) -> "SubmissionItemDecisionRequest":
        if self.status == SubmissionStatus.PENDING:
            raise ValueError("status must be APPROVED or REJECTED.")
        return self
