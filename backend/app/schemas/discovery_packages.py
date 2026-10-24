"""Strict, versioned, non-executable package manifest contract."""

import math
from typing import Literal
from urllib.parse import urlsplit
from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator
from app.schemas.discovery import DiscoveryExploration


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class PackageAsset(StrictModel):
    path: str = Field(min_length=1, max_length=160)
    mime_type: Literal[
        "text/javascript",
        "application/json",
        "text/plain",
        "image/png",
        "image/jpeg",
        "image/webp",
    ]
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class PackageControl(StrictModel):
    id: str = Field(pattern=r"^[a-z][a-z0-9-]*$", max_length=40)
    label: str = Field(min_length=1, max_length=120)
    min: float
    max: float
    step: float = Field(gt=0)
    initial: float
    unit: str = Field(max_length=40)

    @model_validator(mode="after")
    def ranges(self):
        if not self.min < self.max or not self.min <= self.initial <= self.max:
            raise ValueError("Control range and initial value are invalid.")
        if any(abs(v) > 1e6 for v in (self.min, self.max, self.step, self.initial)):
            raise ValueError("Control values exceed the supported range.")
        if self.step > self.max - self.min or (self.max - self.min) / self.step > 10000:
            raise ValueError("Control step must produce at most 10000 intervals.")
        return self


class PackageOutput(StrictModel):
    label: str = Field(min_length=1, max_length=120)
    unit: str = Field(max_length=40)


class PackageScene(StrictModel):
    kind: Literal["proportional", "inverse", "linear"]
    controls: list[PackageControl] = Field(min_length=1, max_length=1)
    output: PackageOutput
    coefficient: float = Field(default=1, ge=-1e6, le=1e6)
    intercept: float = Field(default=0, ge=-1e6, le=1e6)

    @model_validator(mode="after")
    def domain(self):
        control = self.controls[0]
        if self.kind == "inverse" and control.min <= 0 <= control.max:
            raise ValueError("Inverse input range cannot include zero.")
        outputs = [
            (
                self.coefficient / x
                if self.kind == "inverse"
                else self.coefficient * x + self.intercept
            )
            for x in (control.min, control.max)
        ]
        if any(not math.isfinite(value) or abs(value) > 1e12 for value in outputs):
            raise ValueError("Scene output exceeds finite supported range (1e12).")
        if self.kind != "linear" and self.intercept != 0:
            raise ValueError("Only linear scenes support an intercept.")
        return self


class PackageManifest(StrictModel):
    schema_version: Literal[1]
    package_id: str = Field(pattern=r"^[a-z][a-z0-9-]*$", max_length=80)
    version: str = Field(
        pattern=r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$",
        max_length=60,
    )
    runtime: Literal["declarative-v1", "worker-v1"]
    exploration: DiscoveryExploration
    scene: PackageScene | None = None
    entry: str | None = Field(default=None, max_length=160)
    assets: list[PackageAsset] = Field(default_factory=list, max_length=31)

    @field_validator("schema_version", mode="before")
    @classmethod
    def integer_version(cls, value):
        if type(value) is not int:
            raise ValueError("schema_version must be integer 1.")
        return value

    @model_validator(mode="after")
    def contract(self):
        if (
            self.exploration.id != self.package_id
            or self.exploration.package is not None
        ):
            raise ValueError(
                "Exploration id must match package_id and cannot supply package metadata."
            )
        if len(self.exploration.experiments) < 2:
            raise ValueError("Include at least two guided investigations.")
        if self.runtime == "declarative-v1" and (
            self.scene is None or self.entry is not None
        ):
            raise ValueError("Declarative packages require scene and no entry.")
        if self.runtime == "worker-v1" and (
            self.scene is not None or self.entry is None
        ):
            raise ValueError("Worker packages require entry and no scene.")
        if len({a.path for a in self.assets}) != len(self.assets):
            raise ValueError("Asset paths must be unique.")
        if self.entry and not any(
            a.path == self.entry and a.mime_type == "text/javascript"
            for a in self.assets
        ):
            raise ValueError("Worker entry must be a declared JavaScript asset.")
        for source in self.exploration.sources:
            url = urlsplit(source.url)
            if (
                url.scheme != "https"
                or not url.hostname
                or url.username
                or url.password
            ):
                raise ValueError("Sources must use HTTPS URLs without credentials.")

        def plain(value):
            if isinstance(value, str) and (
                len(value) > 12000
                or "<" in value
                or ">" in value
                or any(ord(c) < 32 and c not in "\n\t\r" for c in value)
            ):
                raise ValueError(
                    "Teaching content must be bounded plain text, not HTML."
                )
            if isinstance(value, dict):
                for item in value.values():
                    plain(item)
            if isinstance(value, list):
                for item in value:
                    plain(item)

        plain(self.model_dump())
        return self


class PackageUpload(StrictModel):
    archive_base64: str = Field(min_length=1, max_length=2796204)
