"""Independent synthetic legacy DDL golden fixture; no private rows."""

LEGACY_DDL = {
    'homeschool_courses': """CREATE TABLE homeschool_courses (
	id INTEGER NOT NULL,\x20
	household_id INTEGER NOT NULL,\x20
	subject_area VARCHAR(10) NOT NULL,\x20
	grade_level INTEGER NOT NULL,\x20
	title VARCHAR(255) NOT NULL,\x20
	description VARCHAR(3000) NOT NULL,\x20
	color VARCHAR(32) NOT NULL,\x20
	icon VARCHAR(64) NOT NULL,\x20
	active BOOLEAN NOT NULL,\x20
	archived_at DATETIME,\x20
	created_at DATETIME NOT NULL,\x20
	CONSTRAINT pk_homeschool_courses PRIMARY KEY (id),\x20
	CONSTRAINT ck_homeschool_courses_homeschool_course_grade_level_range CHECK (grade_level >= 1 AND grade_level <= 5),\x20
	CONSTRAINT fk_homeschool_courses_household_id_households FOREIGN KEY(household_id) REFERENCES households (id) ON DELETE CASCADE
)""",
    'homeschool_lessons': """CREATE TABLE homeschool_lessons (
	id INTEGER NOT NULL,\x20
	household_id INTEGER NOT NULL,\x20
	course_id INTEGER NOT NULL,\x20
	title VARCHAR(255) NOT NULL,\x20
	overview VARCHAR(5000) NOT NULL,\x20
	sequence_order INTEGER NOT NULL,\x20
	estimated_minutes INTEGER,\x20
	activity_prompt VARCHAR(5000) NOT NULL,\x20
	answer_key VARCHAR(5000) NOT NULL,\x20
	archived_at DATETIME,\x20
	created_at DATETIME NOT NULL, learning_objectives VARCHAR(12000) DEFAULT '' NOT NULL, materials VARCHAR(12000) DEFAULT '' NOT NULL, warm_up VARCHAR(12000) DEFAULT '' NOT NULL, direct_instruction VARCHAR(12000) DEFAULT '' NOT NULL, guided_practice VARCHAR(12000) DEFAULT '' NOT NULL, independent_practice VARCHAR(12000) DEFAULT '' NOT NULL, assessment VARCHAR(12000) DEFAULT '' NOT NULL, extension VARCHAR(12000) DEFAULT '' NOT NULL, remediation VARCHAR(12000) DEFAULT '' NOT NULL,\x20
	CONSTRAINT pk_homeschool_lessons PRIMARY KEY (id),\x20
	CONSTRAINT uq_homeschool_lessons_course_id UNIQUE (course_id, sequence_order),\x20
	CONSTRAINT ck_homeschool_lessons_homeschool_lesson_positive_sequence CHECK (sequence_order > 0),\x20
	CONSTRAINT ck_homeschool_lessons_homeschool_lesson_positive_minutes CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),\x20
	CONSTRAINT fk_homeschool_lessons_household_id_households FOREIGN KEY(household_id) REFERENCES households (id) ON DELETE CASCADE,\x20
	CONSTRAINT fk_homeschool_lessons_course_id_homeschool_courses FOREIGN KEY(course_id) REFERENCES homeschool_courses (id) ON DELETE CASCADE
)""",
    'homeschool_course_assignments': """CREATE TABLE homeschool_course_assignments (
	course_id INTEGER NOT NULL,\x20
	child_id INTEGER NOT NULL,\x20
	CONSTRAINT pk_homeschool_course_assignments PRIMARY KEY (course_id, child_id),\x20
	CONSTRAINT fk_homeschool_course_assignments_course_id_homeschool_courses FOREIGN KEY(course_id) REFERENCES homeschool_courses (id) ON DELETE CASCADE,\x20
	CONSTRAINT fk_homeschool_course_assignments_child_id_children FOREIGN KEY(child_id) REFERENCES children (id) ON DELETE CASCADE
)""",
    'homeschool_lesson_progress': """CREATE TABLE homeschool_lesson_progress (
	id INTEGER NOT NULL,\x20
	household_id INTEGER NOT NULL,\x20
	child_id INTEGER NOT NULL,\x20
	course_id INTEGER NOT NULL,\x20
	lesson_id INTEGER NOT NULL,\x20
	status VARCHAR(12) NOT NULL,\x20
	score_percent INTEGER,\x20
	completed_at DATETIME,\x20
	notes VARCHAR(3000) NOT NULL,\x20
	created_at DATETIME NOT NULL,\x20
	CONSTRAINT pk_homeschool_lesson_progress PRIMARY KEY (id),\x20
	CONSTRAINT uq_homeschool_lesson_progress_child_id UNIQUE (child_id, lesson_id),\x20
	CONSTRAINT ck_homeschool_lesson_progress_homeschool_progress_score_range CHECK (score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100)),\x20
	CONSTRAINT fk_homeschool_lesson_progress_household_id_households FOREIGN KEY(household_id) REFERENCES households (id) ON DELETE CASCADE,\x20
	CONSTRAINT fk_homeschool_lesson_progress_child_id_children FOREIGN KEY(child_id) REFERENCES children (id) ON DELETE CASCADE,\x20
	CONSTRAINT fk_homeschool_lesson_progress_course_id_homeschool_courses FOREIGN KEY(course_id) REFERENCES homeschool_courses (id) ON DELETE CASCADE,\x20
	CONSTRAINT fk_homeschool_lesson_progress_lesson_id_homeschool_lessons FOREIGN KEY(lesson_id) REFERENCES homeschool_lessons (id) ON DELETE CASCADE
)""",
}

LEGACY_INDEXES = {
    'homeschool_courses': ('CREATE INDEX ix_homeschool_courses_household_id ON homeschool_courses (household_id)', 'CREATE INDEX ix_homeschool_courses_subject_area ON homeschool_courses (subject_area)'),
    'homeschool_lessons': ('CREATE INDEX ix_homeschool_lessons_course_id ON homeschool_lessons (course_id)', 'CREATE INDEX ix_homeschool_lessons_household_id ON homeschool_lessons (household_id)'),
    'homeschool_course_assignments': (),
    'homeschool_lesson_progress': ('CREATE INDEX ix_homeschool_lesson_progress_household_id ON homeschool_lesson_progress (household_id)', 'CREATE INDEX ix_homeschool_lesson_progress_child_id ON homeschool_lesson_progress (child_id)', 'CREATE INDEX ix_homeschool_lesson_progress_lesson_id ON homeschool_lesson_progress (lesson_id)', 'CREATE INDEX ix_homeschool_lesson_progress_course_id ON homeschool_lesson_progress (course_id)'),
}
