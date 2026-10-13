"""Household-scoped genealogy. Facts JSON is validated by strict domain DTOs.

Media/transfer tables and destructive workflows belong to FT-3, not this core.
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
    __table_args__ = (collection_fk(), person_fk(), CheckConstraint('position >= 0', name='nonnegative_position'))
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
        UniqueConstraint('person_id'), UniqueConstraint('collection_id','user_id'), UniqueConstraint('collection_id','child_id'),
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
    for action in ['UPDATE', 'DELETE']:
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
    TRIGGERS.append(f'''CREATE TRIGGER trg_ft_identity_{action.lower()} BEFORE {action} ON family_tree_identity_links
    WHEN NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND household_id=NEW.household_id AND role IN ('PARENT','PARENT_ADMIN'))
    BEGIN SELECT RAISE(ABORT, 'identity target must be an adult'); END''')
for statement in TRIGGERS:
    event.listen(Base.metadata, 'after_create', DDL(statement.replace('CREATE TRIGGER ', 'CREATE TRIGGER IF NOT EXISTS ')).execute_if(dialect='sqlite'))
