"""Guard canonical homeschool subject colors without rewriting legacy rows."""

from alembic import op


revision = "20261031_0032"
down_revision = "20261024_0031"
branch_labels = None
depends_on = None


def _canonical_color(column: str) -> str:
    return f"""(CASE
      WHEN length(trim({column}))=4 AND substr(trim({column}),1,1)='#'
      THEN lower('#' || substr(trim({column}),2,1) || substr(trim({column}),2,1)
                     || substr(trim({column}),3,1) || substr(trim({column}),3,1)
                     || substr(trim({column}),4,1) || substr(trim({column}),4,1))
      ELSE lower(trim({column})) END)"""


def upgrade() -> None:
    if op.get_bind().dialect.name != "sqlite":
        return
    existing_color = _canonical_color("existing.color")
    new_color = _canonical_color("NEW.color")
    old_color = _canonical_color("OLD.color")
    op.execute(
        f"""CREATE TRIGGER IF NOT EXISTS trg_homeschool_subject_color_insert
        BEFORE INSERT ON homeschool_subjects
        WHEN EXISTS (
          SELECT 1 FROM homeschool_subjects AS existing
          WHERE existing.household_id=NEW.household_id
            AND {existing_color}={new_color}
        )
        BEGIN SELECT RAISE(ABORT, 'subject color already used in household'); END"""
    )
    op.execute(
        f"""CREATE TRIGGER IF NOT EXISTS trg_homeschool_subject_color_update
        BEFORE UPDATE OF color, household_id ON homeschool_subjects
        WHEN (NEW.household_id != OLD.household_id OR {new_color}!={old_color})
          AND EXISTS (
            SELECT 1 FROM homeschool_subjects AS existing
            WHERE existing.household_id=NEW.household_id
              AND existing.id != OLD.id
              AND {existing_color}={new_color}
          )
        BEGIN SELECT RAISE(ABORT, 'subject color already used in household'); END"""
    )


def downgrade() -> None:
    if op.get_bind().dialect.name != "sqlite":
        return
    op.execute("DROP TRIGGER IF EXISTS trg_homeschool_subject_color_update")
    op.execute("DROP TRIGGER IF EXISTS trg_homeschool_subject_color_insert")
