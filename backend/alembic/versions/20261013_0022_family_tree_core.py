"""Family Tree adult core, opt-in catalog and household/identity invariants.

Frozen SQLite DDL: never import live application metadata into a migration.
Rollback is disable-only; dropping newly created family history is not safe.
"""
from alembic import op
import sqlalchemy as sa
revision='20261013_0022'
down_revision='20261005_0021'
branch_labels=None
depends_on=None

TABLES = [
    """
CREATE TABLE family_tree_collections (
    id INTEGER NOT NULL,
    household_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    revision INTEGER NOT NULL,
    default_focus_person_id INTEGER,
    created_by_user_id INTEGER,
    updated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT pk_family_tree_collections PRIMARY KEY (id),
    CONSTRAINT uq_family_tree_collections_household_id UNIQUE (household_id),
    CONSTRAINT uq_family_tree_collections_id UNIQUE (id, household_id),
    CONSTRAINT ck_family_tree_collections_revision_positive CHECK (revision >= 1),
    CONSTRAINT fk_family_tree_collections_default_focus_person_id_family_tree_people FOREIGN KEY(default_focus_person_id, id, household_id) REFERENCES family_tree_people (id, collection_id, household_id) ON DELETE RESTRICT,
    CONSTRAINT fk_family_tree_collections_household_id_households FOREIGN KEY(household_id) REFERENCES households (id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_collections_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
)

""",
    """
CREATE TABLE family_tree_people (
    facts JSON NOT NULL,
    search_text VARCHAR(8000) NOT NULL,
    is_locked BOOLEAN NOT NULL,
    lock_reason VARCHAR(1000),
    locked_by_user_id INTEGER,
    locked_at DATETIME,
    archived_at DATETIME,
    merged_into_person_id INTEGER,
    id INTEGER NOT NULL,
    household_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    created_by_user_id INTEGER,
    updated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT pk_family_tree_people PRIMARY KEY (id),
    CONSTRAINT fk_family_tree_people_collection_id_family_tree_collections FOREIGN KEY(collection_id, household_id) REFERENCES family_tree_collections (id, household_id) ON DELETE CASCADE,
    CONSTRAINT uq_family_tree_people_id UNIQUE (id, collection_id, household_id),
    CONSTRAINT fk_family_tree_people_merged_into_person_id_family_tree_people FOREIGN KEY(merged_into_person_id, collection_id, household_id) REFERENCES family_tree_people (id, collection_id, household_id) ON DELETE RESTRICT,
    CONSTRAINT ck_family_tree_people_merged_alias CHECK (merged_into_person_id IS NULL OR (merged_into_person_id != id AND archived_at IS NOT NULL)),
    CONSTRAINT fk_family_tree_people_locked_by_user_id_users FOREIGN KEY(locked_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_family_tree_people_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
)

""",
    """
CREATE TABLE family_tree_person_tags (
    person_id INTEGER NOT NULL,
    tag VARCHAR(100) NOT NULL,
    id INTEGER NOT NULL,
    household_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    created_by_user_id INTEGER,
    updated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT pk_family_tree_person_tags PRIMARY KEY (id),
    CONSTRAINT fk_family_tree_person_tags_collection_id_family_tree_collections FOREIGN KEY(collection_id, household_id) REFERENCES family_tree_collections (id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_person_tags_person_id_family_tree_people FOREIGN KEY(person_id, collection_id, household_id) REFERENCES family_tree_people (id, collection_id, household_id) ON DELETE CASCADE,
    CONSTRAINT uq_family_tree_person_tags_person_id UNIQUE (person_id, tag),
    CONSTRAINT fk_family_tree_person_tags_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
)

""",
    """
CREATE TABLE family_tree_other_names (
    person_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    label VARCHAR(1000),
    position INTEGER NOT NULL,
    id INTEGER NOT NULL,
    household_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    created_by_user_id INTEGER,
    updated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT pk_family_tree_other_names PRIMARY KEY (id),
    CONSTRAINT fk_family_tree_other_names_collection_id_family_tree_collections FOREIGN KEY(collection_id, household_id) REFERENCES family_tree_collections (id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_other_names_person_id_family_tree_people FOREIGN KEY(person_id, collection_id, household_id) REFERENCES family_tree_people (id, collection_id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_other_names_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
)

""",
    """
CREATE TABLE family_tree_parent_links (
    parent_person_id INTEGER NOT NULL,
    child_person_id INTEGER NOT NULL,
    kind VARCHAR(20) NOT NULL,
    facts JSON NOT NULL,
    id INTEGER NOT NULL,
    household_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    created_by_user_id INTEGER,
    updated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT pk_family_tree_parent_links PRIMARY KEY (id),
    CONSTRAINT fk_family_tree_parent_links_collection_id_family_tree_collections FOREIGN KEY(collection_id, household_id) REFERENCES family_tree_collections (id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_parent_links_parent_person_id_family_tree_people FOREIGN KEY(parent_person_id, collection_id, household_id) REFERENCES family_tree_people (id, collection_id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_parent_links_child_person_id_family_tree_people FOREIGN KEY(child_person_id, collection_id, household_id) REFERENCES family_tree_people (id, collection_id, household_id) ON DELETE CASCADE,
    CONSTRAINT uq_family_tree_parent_links_parent_person_id UNIQUE (parent_person_id, child_person_id, kind),
    CONSTRAINT ck_family_tree_parent_links_distinct_endpoints CHECK (parent_person_id != child_person_id),
    CONSTRAINT ck_family_tree_parent_links_parent_kind CHECK (kind IN ('biological','adoptive','step','unknown')),
    CONSTRAINT fk_family_tree_parent_links_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
)

""",
    """
CREATE TABLE family_tree_care_links (
    caregiver_person_id INTEGER NOT NULL,
    recipient_person_id INTEGER NOT NULL,
    kind VARCHAR(20) NOT NULL,
    facts JSON NOT NULL,
    id INTEGER NOT NULL,
    household_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    created_by_user_id INTEGER,
    updated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT pk_family_tree_care_links PRIMARY KEY (id),
    CONSTRAINT fk_family_tree_care_links_collection_id_family_tree_collections FOREIGN KEY(collection_id, household_id) REFERENCES family_tree_collections (id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_care_links_caregiver_person_id_family_tree_people FOREIGN KEY(caregiver_person_id, collection_id, household_id) REFERENCES family_tree_people (id, collection_id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_care_links_recipient_person_id_family_tree_people FOREIGN KEY(recipient_person_id, collection_id, household_id) REFERENCES family_tree_people (id, collection_id, household_id) ON DELETE CASCADE,
    CONSTRAINT ck_family_tree_care_links_distinct_endpoints CHECK (caregiver_person_id != recipient_person_id),
    CONSTRAINT ck_family_tree_care_links_care_kind CHECK (kind IN ('guardian','caregiver')),
    CONSTRAINT fk_family_tree_care_links_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
)

""",
    """
CREATE TABLE family_tree_partner_episodes (
    person_a_id INTEGER NOT NULL,
    person_b_id INTEGER NOT NULL,
    kind VARCHAR(20) NOT NULL,
    facts JSON NOT NULL,
    id INTEGER NOT NULL,
    household_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    created_by_user_id INTEGER,
    updated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT pk_family_tree_partner_episodes PRIMARY KEY (id),
    CONSTRAINT fk_family_tree_partner_episodes_collection_id_family_tree_collections FOREIGN KEY(collection_id, household_id) REFERENCES family_tree_collections (id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_partner_episodes_person_a_id_family_tree_people FOREIGN KEY(person_a_id, collection_id, household_id) REFERENCES family_tree_people (id, collection_id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_partner_episodes_person_b_id_family_tree_people FOREIGN KEY(person_b_id, collection_id, household_id) REFERENCES family_tree_people (id, collection_id, household_id) ON DELETE CASCADE,
    CONSTRAINT ck_family_tree_partner_episodes_canonical_pair CHECK (person_a_id < person_b_id),
    CONSTRAINT ck_family_tree_partner_episodes_partner_kind CHECK (kind IN ('married','civil_union','partners','unknown')),
    CONSTRAINT fk_family_tree_partner_episodes_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
)

""",
    """
CREATE TABLE family_tree_stories (
    person_id INTEGER NOT NULL,
    facts JSON NOT NULL,
    position INTEGER NOT NULL,
    id INTEGER NOT NULL,
    household_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    created_by_user_id INTEGER,
    updated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT pk_family_tree_stories PRIMARY KEY (id),
    CONSTRAINT fk_family_tree_stories_collection_id_family_tree_collections FOREIGN KEY(collection_id, household_id) REFERENCES family_tree_collections (id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_stories_person_id_family_tree_people FOREIGN KEY(person_id, collection_id, household_id) REFERENCES family_tree_people (id, collection_id, household_id) ON DELETE CASCADE,
    CONSTRAINT ck_family_tree_stories_nonnegative_position CHECK (position >= 0),
    CONSTRAINT fk_family_tree_stories_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
)

""",
    """
CREATE TABLE family_tree_residences (
    person_id INTEGER NOT NULL,
    facts JSON NOT NULL,
    is_primary BOOLEAN NOT NULL,
    id INTEGER NOT NULL,
    household_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    created_by_user_id INTEGER,
    updated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT pk_family_tree_residences PRIMARY KEY (id),
    CONSTRAINT fk_family_tree_residences_collection_id_family_tree_collections FOREIGN KEY(collection_id, household_id) REFERENCES family_tree_collections (id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_residences_person_id_family_tree_people FOREIGN KEY(person_id, collection_id, household_id) REFERENCES family_tree_people (id, collection_id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_residences_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
)

""",
    """
CREATE TABLE family_tree_identity_links (
    person_id INTEGER NOT NULL,
    user_id INTEGER,
    child_id INTEGER,
    id INTEGER NOT NULL,
    household_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    created_by_user_id INTEGER,
    updated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT pk_family_tree_identity_links PRIMARY KEY (id),
    CONSTRAINT fk_family_tree_identity_links_collection_id_family_tree_collections FOREIGN KEY(collection_id, household_id) REFERENCES family_tree_collections (id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_identity_links_person_id_family_tree_people FOREIGN KEY(person_id, collection_id, household_id) REFERENCES family_tree_people (id, collection_id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_identity_links_user_id_users FOREIGN KEY(user_id, household_id) REFERENCES users (id, household_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_tree_identity_links_child_id_children FOREIGN KEY(child_id, household_id) REFERENCES children (id, household_id) ON DELETE CASCADE,
    CONSTRAINT uq_family_tree_identity_links_person_id UNIQUE (person_id),
    CONSTRAINT uq_family_tree_identity_links_collection_id UNIQUE (collection_id, user_id),
    CONSTRAINT uq_family_tree_identity_links_collection_id UNIQUE (collection_id, child_id),
    CONSTRAINT ck_family_tree_identity_links_exactly_one_identity CHECK ((user_id IS NULL) != (child_id IS NULL)),
    CONSTRAINT fk_family_tree_identity_links_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
)

""",
    """
CREATE TABLE family_tree_mutation_receipts (
    id INTEGER NOT NULL,
    household_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    actor_user_id INTEGER NOT NULL,
    operation VARCHAR(120) NOT NULL,
    key_hash VARCHAR(64) NOT NULL,
    body_digest VARCHAR(64) NOT NULL,
    result JSON NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT pk_family_tree_mutation_receipts PRIMARY KEY (id),
    CONSTRAINT fk_family_tree_mutation_receipts_collection_id_family_tree_collections FOREIGN KEY(collection_id, household_id) REFERENCES family_tree_collections (id, household_id) ON DELETE CASCADE,
    CONSTRAINT uq_family_tree_mutation_receipts_household_id UNIQUE (household_id, actor_user_id, operation, key_hash),
    CONSTRAINT fk_family_tree_mutation_receipts_actor_user_id_users FOREIGN KEY(actor_user_id) REFERENCES users (id) ON DELETE CASCADE
)

""",
]
INDEXES = [
    """CREATE INDEX ix_family_tree_people_collection_id ON family_tree_people (collection_id)""",
    """CREATE INDEX ix_family_tree_people_household_id ON family_tree_people (household_id)""",
    """CREATE INDEX ix_family_tree_person_tags_collection_id ON family_tree_person_tags (collection_id)""",
    """CREATE INDEX ix_family_tree_person_tags_household_id ON family_tree_person_tags (household_id)""",
    """CREATE INDEX ix_family_tree_person_tags_person_id ON family_tree_person_tags (person_id)""",
    """CREATE INDEX ix_family_tree_other_names_collection_id ON family_tree_other_names (collection_id)""",
    """CREATE INDEX ix_family_tree_other_names_household_id ON family_tree_other_names (household_id)""",
    """CREATE INDEX ix_family_tree_other_names_person_id ON family_tree_other_names (person_id)""",
    """CREATE INDEX ix_family_tree_parent_links_child_person_id ON family_tree_parent_links (child_person_id)""",
    """CREATE INDEX ix_family_tree_parent_links_collection_id ON family_tree_parent_links (collection_id)""",
    """CREATE INDEX ix_family_tree_parent_links_household_id ON family_tree_parent_links (household_id)""",
    """CREATE INDEX ix_family_tree_parent_links_parent_person_id ON family_tree_parent_links (parent_person_id)""",
    """CREATE INDEX ix_family_tree_care_links_caregiver_person_id ON family_tree_care_links (caregiver_person_id)""",
    """CREATE INDEX ix_family_tree_care_links_collection_id ON family_tree_care_links (collection_id)""",
    """CREATE INDEX ix_family_tree_care_links_household_id ON family_tree_care_links (household_id)""",
    """CREATE INDEX ix_family_tree_care_links_recipient_person_id ON family_tree_care_links (recipient_person_id)""",
    """CREATE INDEX ix_family_tree_partner_episodes_collection_id ON family_tree_partner_episodes (collection_id)""",
    """CREATE INDEX ix_family_tree_partner_episodes_household_id ON family_tree_partner_episodes (household_id)""",
    """CREATE INDEX ix_family_tree_partner_episodes_person_a_id ON family_tree_partner_episodes (person_a_id)""",
    """CREATE INDEX ix_family_tree_partner_episodes_person_b_id ON family_tree_partner_episodes (person_b_id)""",
    """CREATE INDEX ix_family_tree_stories_collection_id ON family_tree_stories (collection_id)""",
    """CREATE INDEX ix_family_tree_stories_household_id ON family_tree_stories (household_id)""",
    """CREATE INDEX ix_family_tree_stories_person_id ON family_tree_stories (person_id)""",
    """CREATE INDEX ix_family_tree_residences_collection_id ON family_tree_residences (collection_id)""",
    """CREATE INDEX ix_family_tree_residences_household_id ON family_tree_residences (household_id)""",
    """CREATE INDEX ix_family_tree_residences_person_id ON family_tree_residences (person_id)""",
    """CREATE UNIQUE INDEX ux_family_tree_residence_primary ON family_tree_residences (person_id) WHERE is_primary = 1""",
    """CREATE INDEX ix_family_tree_identity_links_collection_id ON family_tree_identity_links (collection_id)""",
    """CREATE INDEX ix_family_tree_identity_links_household_id ON family_tree_identity_links (household_id)""",
    """CREATE INDEX ix_family_tree_mutation_receipts_expires_at ON family_tree_mutation_receipts (expires_at)""",
    """CREATE INDEX ix_family_tree_mutation_receipts_household_id ON family_tree_mutation_receipts (household_id)""",
]
TRIGGERS = [
    """CREATE TRIGGER trg_ft_users_update BEFORE UPDATE OF active, household_id, role ON users
        BEGIN UPDATE family_tree_collections SET revision=revision+1, updated_at=CURRENT_TIMESTAMP
        WHERE id IN (SELECT collection_id FROM family_tree_identity_links WHERE user_id=OLD.id); END""",
    """CREATE TRIGGER trg_ft_users_delete BEFORE DELETE ON users
        BEGIN UPDATE family_tree_collections SET revision=revision+1, updated_at=CURRENT_TIMESTAMP
        WHERE id IN (SELECT collection_id FROM family_tree_identity_links WHERE user_id=OLD.id); END""",
    """CREATE TRIGGER trg_ft_children_update BEFORE UPDATE OF active, household_id, name ON children
        BEGIN UPDATE family_tree_collections SET revision=revision+1, updated_at=CURRENT_TIMESTAMP
        WHERE id IN (SELECT collection_id FROM family_tree_identity_links WHERE child_id=OLD.id); END""",
    """CREATE TRIGGER trg_ft_children_delete BEFORE DELETE ON children
        BEGIN UPDATE family_tree_collections SET revision=revision+1, updated_at=CURRENT_TIMESTAMP
        WHERE id IN (SELECT collection_id FROM family_tree_identity_links WHERE child_id=OLD.id); END""",
    """CREATE TRIGGER trg_ft_alias_insert BEFORE INSERT ON family_tree_people
    WHEN NEW.merged_into_person_id IS NOT NULL AND (
      NOT EXISTS (SELECT 1 FROM family_tree_people WHERE id=NEW.merged_into_person_id AND household_id=NEW.household_id AND collection_id=NEW.collection_id AND merged_into_person_id IS NULL)
      OR EXISTS (SELECT 1 FROM family_tree_people WHERE merged_into_person_id=NEW.id))
    BEGIN SELECT RAISE(ABORT, 'merged aliases must be flat'); END""",
    """CREATE TRIGGER trg_ft_alias_update BEFORE UPDATE ON family_tree_people
    WHEN NEW.merged_into_person_id IS NOT NULL AND (
      NOT EXISTS (SELECT 1 FROM family_tree_people WHERE id=NEW.merged_into_person_id AND household_id=NEW.household_id AND collection_id=NEW.collection_id AND merged_into_person_id IS NULL)
      OR EXISTS (SELECT 1 FROM family_tree_people WHERE merged_into_person_id=NEW.id))
    BEGIN SELECT RAISE(ABORT, 'merged aliases must be flat'); END""",
    """CREATE TRIGGER trg_ft_identity_insert BEFORE INSERT ON family_tree_identity_links
    WHEN NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND household_id=NEW.household_id AND role IN ('PARENT','PARENT_ADMIN'))
    BEGIN SELECT RAISE(ABORT, 'identity target must be an adult'); END""",
    """CREATE TRIGGER trg_ft_identity_update BEFORE UPDATE ON family_tree_identity_links
    WHEN NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND household_id=NEW.household_id AND role IN ('PARENT','PARENT_ADMIN'))
    BEGIN SELECT RAISE(ABORT, 'identity target must be an adult'); END""",
]

def upgrade():
    bind=op.get_bind()
    if bind.dialect.name!='sqlite':
        raise RuntimeError('Family Tree migration requires the supported SQLite database.')
    op.create_index('ux_users_id_household','users',['id','household_id'],unique=True)
    op.create_index('ux_children_id_household','children',['id','household_id'],unique=True)
    for statement in TABLES+INDEXES+TRIGGERS:
        op.execute(sa.text(statement))
    # Unrelated catalog/grants are preserved. No people or inferred account links.
    op.execute(sa.text("INSERT INTO modules (key,name,description,enabled) VALUES ('family-tree','Family Tree','Household family history, relationships, stories and photographs.',0) ON CONFLICT(key) DO UPDATE SET enabled=0"))
    op.execute(sa.text("INSERT INTO household_module_access (household_id,module_key,enabled,created_at) SELECT id,'family-tree',0,CURRENT_TIMESTAMP FROM households WHERE 1 ON CONFLICT(household_id,module_key) DO UPDATE SET enabled=0"))

def downgrade():
    raise RuntimeError('Family Tree rollback is disable-only; preserve household history and schema.')
