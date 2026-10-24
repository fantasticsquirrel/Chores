from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class DiscoveryExperiment(BaseModel):
    model_config = ConfigDict(
        extra="forbid", strict=True, str_min_length=1, str_max_length=12000
    )
    title: str
    instruction: str
    observe: str


class DiscoverySource(BaseModel):
    model_config = ConfigDict(
        extra="forbid", strict=True, str_min_length=1, str_max_length=2000
    )
    title: str
    url: str


class DiscoveryPackageReference(BaseModel):
    version: str
    runtime: Literal["declarative-v1", "worker-v1"]
    checksum: str


class DiscoveryExploration(BaseModel):
    model_config = ConfigDict(
        extra="forbid", strict=True, str_min_length=1, str_max_length=12000
    )
    id: str = Field(pattern=r"^[a-z][a-z0-9-]*$", max_length=80)
    package: DiscoveryPackageReference | None = None
    title: str
    summary: str
    subject: str
    grade_bands: list[Literal["K-2", "3-5", "6-8", "9-12"]] = Field(
        min_length=1, max_length=4
    )
    tags: list[str] = Field(min_length=1, max_length=32)
    duration_minutes: int = Field(gt=0, le=180)
    question: str
    explanation: str
    experiments: list[DiscoveryExperiment] = Field(min_length=1, max_length=12)
    misconception: str
    sources: list[DiscoverySource] = Field(min_length=1, max_length=16)

    @field_validator("tags", "grade_bands")
    @classmethod
    def unique_values(cls, values):
        if len(set(values)) != len(values) or any(
            not value.strip() for value in values
        ):
            raise ValueError("Metadata values must be nonempty and unique.")
        return values


class DiscoveryExplorationAccessResponse(DiscoveryExploration):
    enabled: bool
    override: bool | None


class DiscoveryChildAccessResponse(BaseModel):
    child_id: int
    default_enabled: bool
    explorations: list[DiscoveryExplorationAccessResponse]


class DiscoveryChildResponse(BaseModel):
    id: int
    name: str
    active: bool
