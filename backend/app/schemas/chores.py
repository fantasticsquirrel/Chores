from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.models.enums import AssignmentMode, CompletionMode, ScheduleMode, ScheduleUnit


class ChoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    name: str
    reward_cents: int
    start_date: date
    expires_at: date | None
    timeout_days: int | None
    schedule_mode: ScheduleMode
    schedule_interval: int | None
    schedule_unit: ScheduleUnit | None
    completion_mode: CompletionMode
    assignment_mode: AssignmentMode
    archived_at: datetime | None
    # Populated by the API layer (not ORM-mapped)
    allowed_child_ids: list[int] = Field(default_factory=list)
    rotation_order: list[int] = Field(default_factory=list)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def reward_dollars(self) -> float:
        return self.reward_cents / 100

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_active(self) -> bool:
        return self.archived_at is None


class CreateChoreRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    reward_cents: int = Field(ge=0)
    start_date: date
    expires_at: date | None = None
    timeout_days: int | None = Field(default=None, gt=0)
    schedule_mode: ScheduleMode = ScheduleMode.NONE
    schedule_interval: int | None = Field(default=None, gt=0)
    schedule_unit: ScheduleUnit | None = None
    completion_mode: CompletionMode = CompletionMode.PER_CHILD
    assignment_mode: AssignmentMode = AssignmentMode.STATIC
    # [] = all children allowed; non-empty = only those children (STATIC mode)
    allowed_child_ids: list[int] = Field(default_factory=list)
    # Ordered child IDs for rotation (ROTATING mode only)
    rotation_order: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_schedule_and_assignment(self) -> "CreateChoreRequest":
        if self.schedule_mode == ScheduleMode.EVERY:
            if self.schedule_interval is None or self.schedule_unit is None:
                raise ValueError("schedule_interval and schedule_unit are required when schedule_mode is EVERY.")
        elif self.schedule_mode == ScheduleMode.AFTER_COMPLETION:
            if self.schedule_interval is None or self.schedule_unit is None:
                raise ValueError("schedule_interval and schedule_unit are required when schedule_mode is AFTER_COMPLETION.")
        else:
            if self.schedule_interval is not None or self.schedule_unit is not None:
                raise ValueError("schedule_interval and schedule_unit must be null when schedule_mode is not EVERY or AFTER_COMPLETION.")

        if self.assignment_mode == AssignmentMode.ROTATING and len(self.rotation_order) < 2:
            raise ValueError("rotation_order must contain at least 2 children when assignment_mode is ROTATING.")

        return self


class UpdateChoreRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    reward_cents: int | None = Field(default=None, ge=0)
    start_date: date | None = None
    expires_at: date | None = None
    timeout_days: int | None = Field(default=None, gt=0)
    schedule_mode: ScheduleMode | None = None
    schedule_interval: int | None = Field(default=None, gt=0)
    schedule_unit: ScheduleUnit | None = None
    completion_mode: CompletionMode | None = None
    assignment_mode: AssignmentMode | None = None
    # None = don't touch; [] = clear (all allowed); [ids] = set specific children
    allowed_child_ids: list[int] | None = None
    rotation_order: list[int] | None = None

    @model_validator(mode="after")
    def validate_at_least_one(self) -> "UpdateChoreRequest":
        fields = [
            self.name, self.reward_cents, self.start_date, self.schedule_mode,
            self.completion_mode, self.assignment_mode, self.allowed_child_ids,
            self.rotation_order,
        ]
        if all(f is None for f in fields):
            raise ValueError("At least one field must be provided for update.")
        return self
