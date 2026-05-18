from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, model_validator


class HomeschoolSemesterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    name: str
    start_date: date
    end_date: date
    active: bool


class CreateHomeschoolSemesterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    start_date: date
    end_date: date
    active: bool = True

    @model_validator(mode="after")
    def validate_dates(self) -> "CreateHomeschoolSemesterRequest":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date.")
        return self


class HomeschoolSubjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    name: str
    color: str
    active: bool


class CreateHomeschoolSubjectRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    color: str = Field(default="#3b82f6", min_length=1, max_length=32)
    active: bool = True


class HomeschoolAttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    child_id: int
    subject_id: int
    date: date
    present: bool
    comment: str


class UpsertHomeschoolAttendanceRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    child_id: int = Field(gt=0)
    subject_id: int = Field(gt=0)
    date: date
    present: bool = True
    comment: str = Field(default="", max_length=2000)
