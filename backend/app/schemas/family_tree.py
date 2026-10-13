"""Strict caller DTOs; omitted PATCH fields differ from explicit nulls.

Markdown subset: paragraphs, emphasis, lists and HTTP(S) citations; raw HTML,
images, autoloaded resources and non-HTTP(S) links are rejected, not rendered.
"""
import calendar
from datetime import date
import re
from typing import Annotated, Literal
from urllib.parse import urlsplit, unquote

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Id = Annotated[int, Field(strict=True, gt=0)]
Revision = Annotated[int, Field(strict=True, ge=0)]
Text = Annotated[str, Field(max_length=1000)]
LongText = Annotated[str, Field(max_length=50000)]
Key = Annotated[str, Field(min_length=1, max_length=200)]

class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class DomainErrorDetail(Strict):
    code: Literal['revision_conflict','person_locked','person_merged','relationship_cycle','identity_link_conflict','idempotency_conflict','integrity_conflict','resource_limit','validation_error','chronology_review','server_busy','merge_aliases_present','merge_conflict','transfer_expired','media_unavailable','storage_unavailable']
    message: str
    canonical_person_id: int | None = None
    warnings: list[str] = Field(default_factory=list)
    blocking_alias_ids: list[int] = Field(default_factory=list)

class DomainErrorResponse(Strict):
    detail: DomainErrorDetail | str

class PartialDate(Strict):
    value: str
    precision: Literal['year','month','day'] | None = None
    uncertain: bool = False

    @model_validator(mode='after')
    def valid_date(self):
        if not re.fullmatch(r'[0-9]{4}(?:-[0-9]{2})?(?:-[0-9]{2})?', self.value):
            raise ValueError('Use YYYY, YYYY-MM or YYYY-MM-DD.')
        parts = [int(p) for p in self.value.split('-')]
        date(parts[0], parts[1] if len(parts)>1 else 1, parts[2] if len(parts)>2 else 1)
        self.precision = ['year','month','day'][len(parts)-1]
        return self

    def bounds(self):
        p = [int(p) for p in self.value.split('-')]
        y=p[0]; m=p[1] if len(p)>1 else 1
        lo=date(y,m,p[2] if len(p)>2 else 1)
        hi=date(y,12,31) if len(p)==1 else date(y,m,calendar.monthrange(y,m)[1]) if len(p)==2 else lo
        return lo,hi


def safe_url(value):
    if value is None or value == '': return value
    parsed=urlsplit(value)
    if parsed.scheme.lower() not in {'http','https'} or not parsed.hostname or parsed.username or parsed.password or any(ord(c)<32 for c in value):
        raise ValueError('Only HTTP(S) citation URLs are allowed.')
    return value


def safe_markdown(value):
    if value is None: return value
    if '<' in value or re.search(r'!\s*\[',value) or re.search(r'^\s*\[[^\]]+\]:',value,re.M):
        raise ValueError('Raw HTML, images and reference links are unsupported.')
    for match in re.finditer(r'\]\s*\(([^)]*)\)',value):
        safe_url(unquote(match.group(1).strip().split(' ',1)[0]))
    return value


def chronology(start, end):
    if not start or not end: return []
    lo, hi = start.bounds(); endlo,endhi=end.bounds()
    if lo>endhi and not (start.uncertain or end.uncertain):
        raise ValueError('End cannot be definitely before start.')
    return ['chronology_review'] if hi>endlo or start.uncertain or end.uncertain else []

class Alias(Strict):
    name: Annotated[str, Field(min_length=1,max_length=255)]
    label: Text | None = None

class AliasDTO(Alias):
    id: int
    created_by_user_id: int | None
    created_at: str

class PersonFields(Strict):
    first_name: Text | None = None
    middle_name: Text | None = None
    last_name: Text | None = None
    maiden_name: Text | None = None
    suffix: Text | None = None
    display_name: Text | None = None
    aliases: Annotated[list[Alias],Field(max_length=50)] = Field(default_factory=list)
    gender: Text | None = None
    living_status: Literal['living','deceased','unknown'] = 'unknown'
    birth_date: PartialDate | None = None
    death_date: PartialDate | None = None
    birth_place: Text | None = None
    death_place: Text | None = None
    birth_source: Text | None = None
    death_source: Text | None = None
    notes_md: LongText | None = None
    source_label: Text | None = None
    source_url: Text | None = None
    tags: Annotated[list[Annotated[str,Field(min_length=1,max_length=100)]],Field(max_length=50)] = Field(default_factory=list)
    _notes = field_validator('notes_md')(safe_markdown)
    _url = field_validator('source_url')(safe_url)

class PersonCreate(PersonFields):
    @model_validator(mode='after')
    def validate_person(self):
        if not any(getattr(self,k) for k in ['first_name','middle_name','last_name','maiden_name','display_name']) and not self.aliases:
            raise ValueError('At least one entered name is required.')
        chronology(self.birth_date,self.death_date)
        return self

class PersonPatch(PersonFields):
    @model_validator(mode='after')
    def nonempty(self):
        if not self.model_fields_set: raise ValueError('Empty patches are not supported.')
        if any(getattr(self,k) is None for k in self.model_fields_set & {'aliases','tags','living_status'}):
            raise ValueError('This field cannot be null.')
        return self

class Command(Strict):
    expected_graph_revision: Revision
    reviewed_warnings: Annotated[list[Literal['chronology_review']],Field(max_length=1)] = Field(default_factory=list)
    idempotency_key: Key | None = None

class CreatePerson(Command):
    idempotency_key: Key
    person: PersonCreate

class PatchPerson(Command):
    changes: PersonPatch

class ReasonCommand(Command):
    reason: Annotated[str,Field(min_length=1,max_length=1000)]

class Citation(Strict):
    notes_md: LongText | None = None
    source_label: Text | None = None
    source_url: Text | None = None
    _notes=field_validator('notes_md')(safe_markdown)
    _url=field_validator('source_url')(safe_url)

class DatedCitation(Citation):
    start_date: PartialDate | None = None
    end_date: PartialDate | None = None
    @model_validator(mode='after')
    def dates(self):
        chronology(self.start_date,self.end_date)
        return self

class ParentData(Citation):
    parent_person_id: Id
    child_person_id: Id
    kind: Literal['biological','adoptive','step','unknown']

class CareData(DatedCitation):
    caregiver_person_id: Id
    recipient_person_id: Id
    kind: Literal['guardian','caregiver']

class PartnerData(DatedCitation):
    person_a_id: Id
    person_b_id: Id
    kind: Literal['married','civil_union','partners','unknown']
    status: Literal['current','separated','ended','unknown'] = 'unknown'

class CreateParent(Command,ParentData): pass
class CreateCare(Command,CareData): pass
class CreatePartner(Command,PartnerData): pass

# Changes are optional individually; final combined state is validated as Data.
class ParentChanges(Citation):
    parent_person_id: Id | None = None
    child_person_id: Id | None = None
    kind: Literal['biological','adoptive','step','unknown'] | None = None
class CareChanges(DatedCitation):
    caregiver_person_id: Id | None = None
    recipient_person_id: Id | None = None
    kind: Literal['guardian','caregiver'] | None = None
class PartnerChanges(DatedCitation):
    person_a_id: Id | None = None
    person_b_id: Id | None = None
    kind: Literal['married','civil_union','partners','unknown'] | None = None
    status: Literal['current','separated','ended','unknown'] | None = None
class PatchParent(Command): changes: ParentChanges
class PatchCare(Command): changes: CareChanges
class PatchPartner(Command): changes: PartnerChanges

class RelativeRelationship(DatedCitation):
    direction: Literal['parent','child','caregiver','recipient','partner']
    kind: Literal['biological','adoptive','step','unknown','guardian','caregiver','married','civil_union','partners']
    status: Literal['current','separated','ended','unknown'] = 'unknown'
    @model_validator(mode='after')
    def applicable(self):
        kinds={'parent':{'biological','adoptive','step','unknown'},'child':{'biological','adoptive','step','unknown'},'caregiver':{'guardian','caregiver'},'recipient':{'guardian','caregiver'},'partner':{'married','civil_union','partners','unknown'}}
        if self.kind not in kinds[self.direction]: raise ValueError('Kind does not match relationship direction.')
        if self.direction in {'parent','child'} and (self.start_date or self.end_date or self.status!='unknown'): raise ValueError('Parent facts do not have episode dates/status.')
        if self.direction!='partner' and self.status!='unknown': raise ValueError('Only partnership episodes have status.')
        return self

class CreateRelative(Command):
    idempotency_key: Key
    anchor_person_id: Id
    relationship: RelativeRelationship
    person: PersonCreate

class StoryData(Strict):
    title: Annotated[str,Field(min_length=1,max_length=500)]
    body_md: LongText
    date: PartialDate | None = None
    source_label: Text | None = None
    source_url: Text | None = None
    _body=field_validator('body_md')(safe_markdown)
    _url=field_validator('source_url')(safe_url)
class StoryChanges(Strict):
    title: Annotated[str,Field(min_length=1,max_length=500)] | None = None
    body_md: LongText | None = None
    date: PartialDate | None = None
    source_label: Text | None = None
    source_url: Text | None = None
    _body=field_validator('body_md')(safe_markdown)
    _url=field_validator('source_url')(safe_url)
class CreateStory(Command):
    idempotency_key: Key
    story: StoryData
class PatchStory(Command): changes: StoryChanges
class ReorderStories(Command): story_ids: Annotated[list[Id],Field(max_length=1000)]

class ResidenceData(DatedCitation):
    place: Annotated[str,Field(min_length=1,max_length=1000)]
    is_primary: bool = False
class ResidenceChanges(DatedCitation):
    place: Annotated[str,Field(min_length=1,max_length=1000)] | None = None
    is_primary: bool | None = None
class CreateResidence(Command): residence: ResidenceData
class PatchResidence(Command): changes: ResidenceChanges

class LinkIdentity(Command):
    user_id: Id | None = None
    child_id: Id | None = None
    confirmed: Literal[True]
    @model_validator(mode='after')
    def exactly_one(self):
        if (self.user_id is None)==(self.child_id is None): raise ValueError('Choose exactly one eligible identity.')
        return self

class Affected(Strict):
    person_ids: list[int] = Field(default_factory=list)
    relationship_ids: list[int] = Field(default_factory=list)
    story_ids: list[int] = Field(default_factory=list)
    residence_ids: list[int] = Field(default_factory=list)
    identity_link_ids: list[int] = Field(default_factory=list)
    media_asset_ids: list[int] = Field(default_factory=list)
    media_reference_ids: list[int] = Field(default_factory=list)
class MutationResult(Strict):
    committed_revision: int
    current_revision: int
    replayed: bool
    affected: Affected
    warnings: list[str] = Field(default_factory=list)
class Capabilities(Strict):
    can_manage: bool
    can_export: bool
    can_purge: bool
class CollectionState(Strict):
    state: Literal['uninitialized','initialized']
    collection_id: int | None
    title: str
    graph_revision: int
    default_focus_person_id: int | None
    active_people_count: int
    archived_people_count: int
    capabilities: Capabilities
class PersonDTO(PersonFields):
    aliases: list[AliasDTO]
    id: int
    created_by_user_id: int | None
    created_at: str
    updated_at: str
    is_locked: bool
    lock_reason: str | None
    locked_by_user_id: int | None
    locked_at: str | None
    archived_at: str | None
    merged_into_person_id: int | None
    primary_image_asset_id: int | None = None
class IdentityDTO(Strict):
    id: int
    person_id: int
    user_id: int | None
    child_id: int | None
    active: bool
    label: str
class ParentDTO(ParentData):
    id: int
    created_by_user_id: int | None
class CareDTO(CareData):
    id: int
    created_by_user_id: int | None
class PartnerDTO(PartnerData):
    id: int
    created_by_user_id: int | None
class StoryDTO(StoryData):
    id: int
    person_id: int
    position: int
    created_by_user_id: int | None
class ResidenceDTO(ResidenceData):
    id: int
    person_id: int
    created_by_user_id: int | None
class PersonDetail(Strict):
    graph_revision: int
    person: PersonDTO
    canonical_person: PersonDTO | None
    parent_links: list[ParentDTO]
    care_links: list[CareDTO]
    partner_episodes: list[PartnerDTO]
    identity_link: IdentityDTO | None
class PeoplePage(Strict):
    graph_revision: int
    items: list[PersonDTO]
    total: int
    next_cursor: int | None
class StoriesPage(Strict):
    graph_revision: int
    items: list[StoryDTO]
    next_cursor: int | None
class ResidencesPage(Strict):
    graph_revision: int
    items: list[ResidenceDTO]
    next_cursor: int | None
class IdentityCandidate(Strict):
    kind: Literal['user','child']
    id: int
    label: str
    active: bool
class IdentityCandidates(Strict):
    items: list[IdentityCandidate]

class GraphNode(Strict):
    id: int
    display_name: str
    living_status: Literal['living','deceased','unknown']
    birth_date: PartialDate | None
    death_date: PartialDate | None
    is_locked: bool
    expansion_counts: dict[Literal['parents','children','partners','care'],int]
class GraphEdge(Strict):
    id: str
    record_id: int
    source_person_id: int
    target_person_id: int
    type: Literal['parent','care','partner']
    kind: str
    status: Literal['current','separated','ended','unknown'] | None = None
    start_date: PartialDate | None = None
    end_date: PartialDate | None = None
class ProjectionLimits(Strict):
    max_nodes: int
    max_edges: int
    hard_max_nodes: int = 500
    hard_max_edges: int = 1000
class GraphProjection(Strict):
    graph_revision: int
    focus_person_id: int | None
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    truncated: bool
    expansion_token: str | None
    warnings: list[str]
    projection_limits: ProjectionLimits
class CompareResult(Strict):
    graph_revision: int
    person_a_id: int
    person_b_id: int
    state: Literal['connected','disconnected','truncated']
    distance: int | None
    person_ids: list[int]
    path: list[GraphEdge]
    warnings: list[str]
    projection_limits: ProjectionLimits
