"""Household-scoped genealogy. Facts JSON is validated by strict domain DTOs.

Private media lifecycle, transfer staging and destructive previews extend the core.
"""
from datetime import UTC, datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Integer, JSON, String, UniqueConstraint, Index, text, event, DDL
from sqlalchemy.orm import Mapped, mapped_column, declared_attr

from app.db import Base, TimestampMixin


def now():
    return datetime.now(UTC)


def collection_fk():
    return ForeignKeyConstraint(['collection_id', 'household_id'], ['family_tree_collections.id', 'family_tree_collections.household_id'], ondelete='CASCADE')


def person_fk(column='person_id', ondelete='CASCADE'):
    return ForeignKeyConstraint([column, 'collection_id', 'household_id'], ['family_tree_people.id', 'family_tree_people.collection_id', 'family_tree_people.household_id'], ondelete=ondelete)


class Attribution(TimestampMixin):
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now, nullable=False)


class Scoped(Attribution):
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    collection_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)


class FamilyTreeCollection(Attribution, Base):
    __tablename__ = 'family_tree_collections'
    __table_args__ = (
        UniqueConstraint('household_id'), UniqueConstraint('id', 'household_id'),
        CheckConstraint('revision >= 1', name='revision_positive'),
        ForeignKeyConstraint(['default_focus_person_id', 'id', 'household_id'], ['family_tree_people.id', 'family_tree_people.collection_id', 'family_tree_people.household_id'], ondelete='RESTRICT', use_alter=True),
    )
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(ForeignKey('households.id', ondelete='CASCADE'), nullable=False)
    title: Mapped[str] = mapped_column(String(255), default='Family Tree', nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    default_focus_person_id: Mapped[int | None] = mapped_column(Integer, nullable=True)


class FamilyTreePerson(Scoped, Base):
    __tablename__ = 'family_tree_people'
    __table_args__ = (
        collection_fk(), UniqueConstraint('id', 'collection_id', 'household_id'),
        person_fk('merged_into_person_id', 'RESTRICT'),
        CheckConstraint('merged_into_person_id IS NULL OR (merged_into_person_id != id AND archived_at IS NOT NULL)', name='merged_alias'),
    )
    facts: Mapped[dict] = mapped_column(JSON, nullable=False)
    search_text: Mapped[str] = mapped_column(String(8000), nullable=False, default='')
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    lock_reason: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    locked_by_user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    merged_into_person_id: Mapped[int | None] = mapped_column(Integer, nullable=True)


class FamilyTreePersonTag(Scoped, Base):
    __tablename__ = 'family_tree_person_tags'
    __table_args__ = (collection_fk(), person_fk(), UniqueConstraint('person_id', 'tag'))
    person_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    tag: Mapped[str] = mapped_column(String(100), nullable=False)


class FamilyTreeOtherName(Scoped, Base):
    __tablename__ = 'family_tree_other_names'
    __table_args__ = (collection_fk(), person_fk())
    person_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    label: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class FamilyTreeParentLink(Scoped, Base):
    __tablename__ = 'family_tree_parent_links'
    __table_args__ = (collection_fk(), person_fk('parent_person_id'), person_fk('child_person_id'), UniqueConstraint('parent_person_id', 'child_person_id', 'kind'), CheckConstraint('parent_person_id != child_person_id', name='distinct_endpoints'), CheckConstraint("kind IN ('biological','adoptive','step','unknown')", name='parent_kind'))
    parent_person_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    child_person_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    facts: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class FamilyTreeCareLink(Scoped, Base):
    __tablename__ = 'family_tree_care_links'
    __table_args__ = (collection_fk(), person_fk('caregiver_person_id'), person_fk('recipient_person_id'), CheckConstraint('caregiver_person_id != recipient_person_id', name='distinct_endpoints'), CheckConstraint("kind IN ('guardian','caregiver')", name='care_kind'))
    caregiver_person_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    recipient_person_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    facts: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class FamilyTreePartnerEpisode(Scoped, Base):
    __tablename__ = 'family_tree_partner_episodes'
    __table_args__ = (collection_fk(), person_fk('person_a_id'), person_fk('person_b_id'), CheckConstraint('person_a_id < person_b_id', name='canonical_pair'), CheckConstraint("kind IN ('married','civil_union','partners','unknown')", name='partner_kind'))
    person_a_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    person_b_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    facts: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class FamilyTreeStory(Scoped, Base):
    __tablename__ = 'family_tree_stories'
    __table_args__ = (collection_fk(), person_fk(), UniqueConstraint('id','person_id','collection_id','household_id'), CheckConstraint('position >= 0', name='nonnegative_position'))
    person_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    facts: Mapped[dict] = mapped_column(JSON, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class FamilyTreeResidence(Scoped, Base):
    __tablename__ = 'family_tree_residences'
    __table_args__ = (collection_fk(), person_fk(), Index('ux_family_tree_residence_primary', 'person_id', unique=True, sqlite_where=text('is_primary = 1')))
    person_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    facts: Mapped[dict] = mapped_column(JSON, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class FamilyTreeIdentityLink(Scoped, Base):
    __tablename__ = 'family_tree_identity_links'
    __table_args__ = (
        collection_fk(), person_fk(),
        ForeignKeyConstraint(['user_id','household_id'], ['users.id','users.household_id'], ondelete='CASCADE'),
        ForeignKeyConstraint(['child_id','household_id'], ['children.id','children.household_id'], ondelete='CASCADE'),
        UniqueConstraint('person_id'), UniqueConstraint('collection_id','user_id',name='uq_family_tree_identity_links_collection_user'), UniqueConstraint('collection_id','child_id',name='uq_family_tree_identity_links_collection_child'),
        CheckConstraint('(user_id IS NULL) != (child_id IS NULL)', name='exactly_one_identity'),
    )
    person_id: Mapped[int] = mapped_column(Integer, nullable=False)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    child_id: Mapped[int | None] = mapped_column(Integer, nullable=True)


class FamilyTreeMutationReceipt(TimestampMixin, Base):
    __tablename__ = 'family_tree_mutation_receipts'
    __table_args__ = (collection_fk(), UniqueConstraint('household_id','actor_user_id','operation','key_hash'))
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    collection_id: Mapped[int] = mapped_column(Integer, nullable=False)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    operation: Mapped[str] = mapped_column(String(120), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    body_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    result: Mapped[dict] = mapped_column(JSON, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


FAMILY_TREE_MODELS = (FamilyTreeCollection, FamilyTreePerson, FamilyTreePersonTag, FamilyTreeOtherName, FamilyTreeParentLink, FamilyTreeCareLink, FamilyTreePartnerEpisode, FamilyTreeStory, FamilyTreeResidence, FamilyTreeIdentityLink, FamilyTreeMutationReceipt)

# SQLite is the supported deployment database. Triggers also cover direct/bulk
# identity lifecycle writes, not just a particular API/service entry point.
TRIGGERS = []
for table, target in [('users','user_id'), ('children','child_id')]:
    for action in (['UPDATE'] if table == 'users' else ['UPDATE', 'DELETE']):
        fields = ' OF active, household_id, role' if table == 'users' else ' OF active, household_id, name'
        if action == 'DELETE':
            fields = ''
        TRIGGERS.append(f'''CREATE TRIGGER trg_ft_{table}_{action.lower()} BEFORE {action}{fields} ON {table}
        BEGIN UPDATE family_tree_collections SET revision=revision+1, updated_at=CURRENT_TIMESTAMP
        WHERE id IN (SELECT collection_id FROM family_tree_identity_links WHERE {target}=OLD.id); END''')
for action in ['INSERT', 'UPDATE']:
    TRIGGERS.append(f'''CREATE TRIGGER trg_ft_alias_{action.lower()} BEFORE {action} ON family_tree_people
    WHEN NEW.merged_into_person_id IS NOT NULL AND (
      NOT EXISTS (SELECT 1 FROM family_tree_people WHERE id=NEW.merged_into_person_id AND household_id=NEW.household_id AND collection_id=NEW.collection_id AND merged_into_person_id IS NULL)
      OR EXISTS (SELECT 1 FROM family_tree_people WHERE merged_into_person_id=NEW.id))
    BEGIN SELECT RAISE(ABORT, 'merged aliases must be flat'); END''')
for action in ['INSERT','UPDATE']:
    # Creator SET NULL is attribution cleanup, not an identity-target change.
    # During user deletion the target CASCADE may run after creator nulling.
    mutation = 'UPDATE OF user_id, household_id' if action == 'UPDATE' else action
    TRIGGERS.append(f'''CREATE TRIGGER trg_ft_identity_{action.lower()} BEFORE {mutation} ON family_tree_identity_links
    WHEN NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND household_id=NEW.household_id AND role IN ('PARENT','PARENT_ADMIN'))
    BEGIN SELECT RAISE(ABORT, 'identity target must be an adult'); END''')
for statement in TRIGGERS:
    event.listen(Base.metadata, 'after_create', DDL(statement.replace('CREATE TRIGGER ', 'CREATE TRIGGER IF NOT EXISTS ')).execute_if(dialect='sqlite'))

class FamilyTreeMediaAsset(Scoped, Base):
    __tablename__ = 'family_tree_media_assets'
    __table_args__ = (collection_fk(), UniqueConstraint('id', 'collection_id', 'household_id'),
        CheckConstraint("state IN ('ready','deleting','deleted')", name='media_state'),
        CheckConstraint('byte_size > 0 AND width > 0 AND height > 0', name='media_size'),)
    object_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(30), nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    caption: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default='ready', index=True)
    claim_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    claim_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


def asset_fk():
    return ForeignKeyConstraint(['asset_id', 'collection_id', 'household_id'],
        ['family_tree_media_assets.id', 'family_tree_media_assets.collection_id', 'family_tree_media_assets.household_id'], ondelete='RESTRICT')


class FamilyTreeMediaReference(Scoped, Base):
    __tablename__ = 'family_tree_media_references'
    __table_args__ = (collection_fk(), person_fk(), asset_fk(),
        ForeignKeyConstraint(['story_id', 'person_id', 'collection_id', 'household_id'], ['family_tree_stories.id', 'family_tree_stories.person_id', 'family_tree_stories.collection_id', 'family_tree_stories.household_id'], ondelete='CASCADE'),
        CheckConstraint("(role IN ('primary','gallery') AND story_id IS NULL) OR (role='story' AND story_id IS NOT NULL)", name='reference_target'),
        UniqueConstraint('asset_id', 'person_id', 'role', 'story_id'),
        Index('ux_ft_primary_image', 'person_id', unique=True, sqlite_where=text("role = 'primary'")),)
    asset_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    person_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    story_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)


class FamilyTreeMediaPin(Scoped, Base):
    __tablename__ = 'family_tree_media_pins'
    __table_args__ = (collection_fk(), asset_fk(), UniqueConstraint('asset_id', 'token'))
    asset_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(20), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


class FamilyTreeTransferJob(TimestampMixin, Base):
    __tablename__ = 'family_tree_transfer_jobs'
    __table_args__ = (collection_fk(), CheckConstraint("kind IN ('import','export','merge','purge')", name='job_kind'),
        CheckConstraint("state IN ('ready','committed','canceled','expired','failed')", name='job_state'),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(ForeignKey('households.id', ondelete='CASCADE'), nullable=False, index=True)
    collection_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default='ready')
    expected_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    summary: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    artifact_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    artifact_checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


class FamilyTreeImportSourceKey(Scoped, Base):
    __tablename__ = 'family_tree_import_source_keys'
    __table_args__ = (collection_fk(), person_fk(), UniqueConstraint('person_id'))
    person_id: Mapped[int] = mapped_column(Integer, nullable=False)
    package_digest: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_key: Mapped[str] = mapped_column(String(200), nullable=False)
    provenance: Mapped[dict] = mapped_column(JSON, nullable=False)


FT3_MODELS = (FamilyTreeMediaAsset, FamilyTreeMediaReference, FamilyTreeMediaPin, FamilyTreeTransferJob, FamilyTreeImportSourceKey)
FAMILY_TREE_MODELS += FT3_MODELS
FT3_TRIGGERS = []
for table in ['family_tree_media_references', 'family_tree_media_pins']:
    for action in ['INSERT', 'UPDATE']:
        FT3_TRIGGERS.append(f"""CREATE TRIGGER trg_ft_{table}_{action.lower()} BEFORE {action} ON {table}
        WHEN NOT EXISTS (SELECT 1 FROM family_tree_media_assets WHERE id=NEW.asset_id AND collection_id=NEW.collection_id AND household_id=NEW.household_id AND state='ready')
        BEGIN SELECT RAISE(ABORT, 'asset unavailable'); END""")
FT3_TRIGGERS.append("""CREATE TRIGGER trg_ft_media_claim BEFORE UPDATE OF state ON family_tree_media_assets
WHEN NEW.state='deleting' AND (EXISTS (SELECT 1 FROM family_tree_media_references WHERE asset_id=NEW.id)
OR EXISTS (SELECT 1 FROM family_tree_media_pins WHERE asset_id=NEW.id AND expires_at>CURRENT_TIMESTAMP))
BEGIN SELECT RAISE(ABORT, 'asset retained'); END""")
for statement in FT3_TRIGGERS:
    event.listen(Base.metadata, 'after_create', DDL(statement.replace('CREATE TRIGGER ', 'CREATE TRIGGER IF NOT EXISTS ')).execute_if(dialect='sqlite'))

# Before FK nulling/cascades, invalidate each affected projection exactly once.
# Include attribution on FT3 assets, references, pins and import provenance, plus
# actor-owned receipts/jobs. A deleting household is already outside this set.
_user_deletion_sources = []
for _model in FAMILY_TREE_MODELS:
    _table = _model.__table__
    _collection = 'id' if _model is FamilyTreeCollection else 'collection_id'
    _columns = [name for name in ('created_by_user_id', 'locked_by_user_id', 'actor_user_id', 'user_id') if name in _table.c]
    if _columns:
        _where = ' OR '.join(f'{name}=OLD.id' for name in _columns)
        _user_deletion_sources.append(f'SELECT {_collection} FROM {_table.name} WHERE {_where}')
USER_DELETE_TRIGGER = 'CREATE TRIGGER trg_ft_users_delete BEFORE DELETE ON users BEGIN UPDATE family_tree_collections SET revision=revision+1, updated_at=CURRENT_TIMESTAMP WHERE id IN (' + ' UNION '.join(_user_deletion_sources) + '); END'
event.listen(Base.metadata, 'after_create', DDL(USER_DELETE_TRIGGER.replace('CREATE TRIGGER ', 'CREATE TRIGGER IF NOT EXISTS ')).execute_if(dialect='sqlite'))
