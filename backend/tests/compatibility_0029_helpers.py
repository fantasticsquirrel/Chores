"""Synthetic predecessor fixture and complete snapshots, independent of 0029."""
import re
import sqlite3
from collections import Counter

from compatibility_0029_fixture import LEGACY_DDL, LEGACY_INDEXES


def snapshot(raw):
    objects = list(raw.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type,name"))
    data = {name: Counter(raw.execute(f'SELECT * FROM "{name}"'))
            for kind, name, _, _ in objects if kind == "table"}
    return objects, data


def insert(raw, table, **values):
    for _, name, kind, required, default, primary in raw.execute(f'PRAGMA table_info("{table}")'):
        if name in values or not required or default is not None:
            continue
        if "INT" in kind or kind in {"BOOLEAN", "FLOAT"}:
            values[name] = 1
        elif kind in {"DATETIME", "DATE"}:
            values[name] = "2026-01-02 03:04:05"
        else:
            values[name] = "synthetic"
    columns = ",".join(f'"{name}"' for name in values)
    raw.execute(f'INSERT INTO "{table}" ({columns}) VALUES ({",".join("?" for _ in values)})', tuple(values.values()))


def historicize(path):
    raw = sqlite3.connect(path)
    raw.execute("PRAGMA foreign_keys=OFF")
    triggers = list(raw.execute("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY rowid"))
    for name, _ in triggers:
        raw.execute(f'DROP TRIGGER "{name}"')
    for table in ("users", "recipes", "recipe_categories", "recipe_tags"):
        ddl = raw.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()[0]
        indexes = list(raw.execute("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL", (table,)))
        assert raw.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0] == 0
        if table == "users":
            ddl, count = re.subn(r',\s*CONSTRAINT uq_users_email UNIQUE \(email\)(?=\s*\))|\s*CONSTRAINT uq_users_email UNIQUE \(email\),', '', ddl)
        else:
            ddl, count = re.subn(r'updated_at DATETIME NOT NULL', 'updated_at DATETIME', ddl)
        assert count == 1, table
        raw.execute(f'DROP TABLE "{table}"')
        raw.execute(ddl)
        for (sql,) in indexes:
            raw.execute(sql)
    for _, sql in triggers:
        raw.execute(sql)
    for table, ddl in LEGACY_DDL.items():
        raw.execute(ddl)
        for sql in LEGACY_INDEXES[table]:
            raw.execute(sql)
    insert(raw, "households", id=1, name="Synthetic", timezone="UTC", owner_user_id=2)
    insert(raw, "users", id=2, household_id=1, email="owner@example.test", password_hash="unused", role="PARENT_ADMIN", child_id=None, active=1)
    insert(raw, "users", id=3, household_id=1, email="actor@example.test", password_hash="unused", role="PARENT", child_id=None, active=1)
    insert(raw, "children", id=4, household_id=1, name="Synthetic child", active=1)
    insert(raw, "homeschool_courses", id=5, household_id=1, grade_level=3)
    fields = {name: f"instruction:{name}" for name in ("learning_objectives", "materials", "warm_up", "direct_instruction", "guided_practice", "independent_practice", "assessment", "extension", "remediation")}
    insert(raw, "homeschool_lessons", id=6, household_id=1, course_id=5, sequence_order=1, estimated_minutes=20, **fields)
    insert(raw, "homeschool_course_assignments", course_id=5, child_id=4)
    insert(raw, "homeschool_lesson_progress", id=7, household_id=1, child_id=4, course_id=5, lesson_id=6, status="COMPLETED", score_percent=87)
    insert(raw, "recipes", id=8, household_id=1, owner_user_id=3, favorite=0, updated_at="2026-02-03 04:05:06")
    insert(raw, "recipes", id=9, household_id=1, owner_user_id=3, parent_recipe_id=8, favorite=0, updated_at="2026-03-04 05:06:07")
    insert(raw, "recipe_categories", id=10, household_id=1, owner_user_id=3, updated_at="2026-04-05 06:07:08")
    insert(raw, "recipe_tags", id=11, household_id=1, owner_user_id=3, updated_at="2026-05-06 07:08:09")
    insert(raw, "recipe_category_links", recipe_id=8, category_id=10)
    insert(raw, "recipe_tag_links", recipe_id=8, tag_id=11)
    insert(raw, "recipe_ingredients", id=12, recipe_id=8, position=1)
    insert(raw, "recipe_steps", id=13, recipe_id=8, position=1)
    insert(raw, "auth_sessions", id=14, user_id=3, token_hash="synthetic-token", expires_at="2030-01-01")
    insert(raw, "platform_users", id=15, email="platform@example.test", role="PLATFORM_ADMIN", password_hash="unused", active=1)
    insert(raw, "platform_audit_events", id=16, actor_platform_user_id=15, event_type="synthetic", reason="synthetic", details_json="{}")
    if raw.execute("SELECT 1 FROM sqlite_master WHERE name='family_tree_people'").fetchone():
        insert(raw, "family_tree_collections", id=17, household_id=1, title="Synthetic history", revision=9, created_by_user_id=3)
        insert(raw, "family_tree_people", id=18, collection_id=17, household_id=1, facts='{"display_name":"Synthetic","living_status":"unknown"}', search_text="synthetic", is_locked=0, created_by_user_id=3)
        insert(raw, "family_tree_identity_links", id=19, person_id=18, user_id=3, collection_id=17, household_id=1, created_by_user_id=3)
    raw.commit()
    assert list(raw.execute("PRAGMA foreign_key_check")) == []
    raw.close()
