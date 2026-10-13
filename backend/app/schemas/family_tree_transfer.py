"""Strict FT-3 wire/portable schemas. No local account or storage authority."""
from typing import Annotated, Literal
from pydantic import Field, model_validator, StringConstraints
from app.schemas.family_tree import Strict, Command, Id, Key, PersonCreate, Citation, DatedCitation, StoryData, ResidenceData

class AttachMedia(Command):
    person_id: Id
    story_id: Id | None = None
    role: Literal['primary','gallery','story'] = 'gallery'
    @model_validator(mode='after')
    def target(self):
        if (self.role == 'story') != (self.story_id is not None): raise ValueError('Story role requires story ID.')
        return self

class MediaDTO(Strict):
    id: int
    mime_type: str
    byte_size: int
    checksum: str
    width: int
    height: int
    caption: str | None
    state: str

class MediaReferenceDTO(Strict):
    id: int
    asset_id: int
    person_id: int
    story_id: int | None
    role: str
    asset: MediaDTO

class MergePreview(Command):
    source_person_id: Id
    target_person_id: Id
    scalar_choices: dict[str, Literal['source','target']] = Field(default_factory=dict, max_length=30)
    retain_similar_partner_episodes: bool = False

class PreviewCommit(Command):
    idempotency_key: Key
    preview_token: Annotated[str, Field(min_length=32,max_length=64)]

class PurgePreview(Command):
    password: Annotated[str, Field(min_length=1,max_length=1024), StringConstraints(strip_whitespace=False)]
class PurgeCommit(PurgePreview, PreviewCommit): pass
class ExportRequest(Strict):
    format: Literal['json','zip'] = 'zip'
class ImportCommit(Command):
    idempotency_key: Key
    confirmed: Literal[True]
    acknowledge_duplicate_provenance: bool = False
class JobDTO(Strict):
    id: int
    kind: str
    state: str
    expected_graph_revision: int
    expires_at: str
    summary: dict
class PreviewDTO(JobDTO):
    preview_token: str

SourceKey = Annotated[str, Field(min_length=1,max_length=200,pattern=r'^[A-Za-z0-9._:-]+$')]
class Provenance(Strict):
    source_label: str | None = Field(default=None,max_length=1000)
    created_at: str | None = Field(default=None,max_length=100)
    attribution: str | None = Field(default=None,max_length=1000)
class PortablePerson(Strict):
    key: SourceKey
    person: PersonCreate
    is_locked: Annotated[bool, Field(strict=True)] = False
    lock_reason: str | None = Field(default=None,max_length=1000)
    archived: Annotated[bool, Field(strict=True)] = False
    merged_into_key: SourceKey | None = None
    provenance: Provenance = Field(default_factory=Provenance)
class PortableParent(Citation):
    key: SourceKey
    parent_key: SourceKey
    child_key: SourceKey
    kind: Literal['biological','adoptive','step','unknown']
    provenance: Provenance = Field(default_factory=Provenance)
class PortableCare(DatedCitation):
    key: SourceKey
    caregiver_key: SourceKey
    recipient_key: SourceKey
    kind: Literal['guardian','caregiver']
    provenance: Provenance = Field(default_factory=Provenance)
class PortablePartner(DatedCitation):
    key: SourceKey
    person_a_key: SourceKey
    person_b_key: SourceKey
    kind: Literal['married','civil_union','partners','unknown']
    status: Literal['current','separated','ended','unknown'] = 'unknown'
    provenance: Provenance = Field(default_factory=Provenance)
class PortableStory(Strict):
    key: SourceKey
    person_key: SourceKey
    story: StoryData
    position: Annotated[int,Field(strict=True,ge=0)]
    provenance: Provenance = Field(default_factory=Provenance)
class PortableResidence(Strict):
    key: SourceKey
    person_key: SourceKey
    residence: ResidenceData
    provenance: Provenance = Field(default_factory=Provenance)
class PortableMedia(Strict):
    key: SourceKey
    path: Annotated[str,Field(pattern=r'^media/[a-f0-9]{64}\.(png|jpg|webp)$')]
    mime_type: Literal['image/png','image/jpeg','image/webp']
    checksum: Annotated[str,Field(pattern=r'^[a-f0-9]{64}$')]
    byte_size: Annotated[int,Field(strict=True,gt=0,le=10485760)]
    caption: str | None = Field(default=None,max_length=1000)
class PortableReference(Strict):
    key: SourceKey
    asset_key: SourceKey
    person_key: SourceKey
    story_key: SourceKey | None = None
    role: Literal['primary','gallery','story']
class Manifest(Strict):
    schema_version: Literal[1]
    producer: Annotated[str,Field(max_length=100)]
    exported_at: Annotated[str,Field(max_length=100)]
    collection_title: Annotated[str,Field(min_length=1,max_length=255)]
    snapshot_revision: Annotated[int,Field(strict=True,ge=0)]
    default_focus_key: SourceKey | None = None
    media_omitted: Annotated[bool, Field(strict=True)] = False
    people: Annotated[list[PortablePerson],Field(max_length=5000)] = Field(default_factory=list)
    parent_links: Annotated[list[PortableParent],Field(max_length=20000)] = Field(default_factory=list)
    care_links: Annotated[list[PortableCare],Field(max_length=20000)] = Field(default_factory=list)
    partner_episodes: Annotated[list[PortablePartner],Field(max_length=20000)] = Field(default_factory=list)
    stories: Annotated[list[PortableStory],Field(max_length=40000)] = Field(default_factory=list)
    residences: Annotated[list[PortableResidence],Field(max_length=40000)] = Field(default_factory=list)
    media: Annotated[list[PortableMedia],Field(max_length=1000)] = Field(default_factory=list)
    media_references: Annotated[list[PortableReference],Field(max_length=40000)] = Field(default_factory=list)
