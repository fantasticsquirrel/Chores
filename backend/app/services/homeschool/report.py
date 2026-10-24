"""Read-only, household-scoped semester reports. PDF creation stays on our server."""

from __future__ import annotations

from collections import Counter
from html import escape
from io import BytesIO
from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.homeschool import (
    HomeschoolAttendance,
    HomeschoolDayComment,
    HomeschoolGrade,
    HomeschoolSubject,
)
from app.services.homeschool.access import (
    get_household_child_or_404,
    get_household_semester_or_404,
)

FONT_DIR = Path(__file__).with_name("fonts")
pdfmetrics.registerFont(TTFont("HomeschoolSans", str(FONT_DIR / "DejaVuSans.ttf")))
pdfmetrics.registerFont(
    TTFont("HomeschoolSansBold", str(FONT_DIR / "DejaVuSans-Bold.ttf"))
)
pdfmetrics.registerFontFamily(
    "HomeschoolSans", normal="HomeschoolSans", bold="HomeschoolSansBold"
)
INK = colors.HexColor("#182938")
MUTED = colors.HexColor("#52616d")
LINE = colors.HexColor("#dce3e8")
SUPPORTED_CODEPOINTS = set(pdfmetrics.getFont("HomeschoolSans").face.charToGlyph)


def _unsupported(value: str) -> bool:
    return any(
        ord(char) not in SUPPORTED_CODEPOINTS and char not in "\n\r\t" for char in value
    )


def _safe_text(value: str) -> str:
    # User text is literal content, never ReportLab markup or links.
    value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", value)
    value = "".join(
        (
            char
            if ord(char) in SUPPORTED_CODEPOINTS or char in "\n\r\t"
            else f"[U+{ord(char):04X}]"
        )
        for char in value
    )
    return escape(value).replace("\n", "<br/>")


def build_semester_report(
    session: Session,
    *,
    household_id: int,
    child_id: int,
    semester_id: int,
    include_notes: bool = False,
) -> bytes:
    child = get_household_child_or_404(session, child_id, household_id)
    semester = get_household_semester_or_404(session, semester_id, household_id)
    assert semester is not None
    subjects = dict(
        session.execute(
            select(HomeschoolSubject.id, HomeschoolSubject.name).where(
                HomeschoolSubject.household_id == household_id
            )
        ).all()
    )
    attendance = list(
        session.scalars(
            select(HomeschoolAttendance)
            .where(
                HomeschoolAttendance.household_id == household_id,
                HomeschoolAttendance.child_id == child_id,
                HomeschoolAttendance.date >= semester.start_date,
                HomeschoolAttendance.date <= semester.end_date,
            )
            .order_by(HomeschoolAttendance.date, HomeschoolAttendance.subject_id)
        )
    )
    grades = list(
        session.scalars(
            select(HomeschoolGrade).where(
                HomeschoolGrade.household_id == household_id,
                HomeschoolGrade.child_id == child_id,
                HomeschoolGrade.semester_id == semester_id,
            )
        )
    )
    grades = [
        grade
        for grade in grades
        if grade.grade.strip() and grade.subject_id in subjects
    ]
    present = Counter(record.subject_id for record in attendance if record.present)
    absent = Counter(record.subject_id for record in attendance if not record.present)
    days = len({record.date for record in attendance if record.present})
    style = ParagraphStyle(
        "Body",
        fontName="HomeschoolSans",
        fontSize=9,
        leading=14,
        textColor=INK,
        spaceAfter=6,
    )
    muted = ParagraphStyle(
        "Muted", parent=style, textColor=MUTED, fontSize=8, leading=12
    )
    heading = ParagraphStyle(
        "Heading",
        parent=style,
        fontName="HomeschoolSansBold",
        fontSize=12,
        leading=17,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True,
    )
    title = ParagraphStyle(
        "Title", parent=heading, fontSize=22, leading=28, spaceBefore=0
    )
    bold = ParagraphStyle("Bold", parent=style, fontName="HomeschoolSansBold")

    unsupported_glyphs = False

    def p(text: str, selected_style=style):
        nonlocal unsupported_glyphs
        unsupported_glyphs = unsupported_glyphs or _unsupported(text)
        return Paragraph(_safe_text(text), selected_style)

    def table(rows, widths):
        result = Table(
            [
                [p(str(cell), bold if index == 0 else style) for cell in row]
                for index, row in enumerate(rows)
            ],
            colWidths=widths,
            repeatRows=1,
            hAlign="LEFT",
        )
        result.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef3f5")),
                    ("LINEBELOW", (0, 0), (-1, 0), 0.5, LINE),
                    ("LINEBELOW", (0, 1), (-1, -1), 0.3, LINE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 9),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        return result

    width = A4[0] - 96
    story = [
        p("Semester report", title),
        p(child.name, bold),
        p(
            f"{semester.name} | {semester.start_date.isoformat()} to {semester.end_date.isoformat()}",
            muted,
        ),
        p("Attendance", heading),
    ]
    story.append(
        p(
            f"{days} distinct attendance day{'s' if days != 1 else ''} · {sum(present.values())} present subject entr{'ies' if sum(present.values()) != 1 else 'y'} · {sum(absent.values())} absent subject entr{'ies' if sum(absent.values()) != 1 else 'y'}"
        )
    )
    story.append(
        p(
            "An attendance day has at least one present subject. Each subject entry records one subject on one date.",
            muted,
        )
    )
    subject_ids = sorted(
        set(present) | set(absent), key=lambda key: subjects.get(key, "").casefold()
    )
    if subject_ids:
        story.append(
            table(
                [["Subject", "Present entries", "Absent entries"]]
                + [
                    [
                        subjects.get(key, "Unavailable subject"),
                        present[key],
                        absent[key],
                    ]
                    for key in subject_ids
                ],
                [width * 0.56, width * 0.22, width * 0.22],
            )
        )
    else:
        story.append(p("No attendance recorded in this semester.", muted))
    if grades:
        story.extend(
            [
                p("Grades", heading),
                table(
                    [["Subject", "Recorded grade"]]
                    + [
                        [subjects[grade.subject_id], grade.grade]
                        for grade in sorted(
                            grades,
                            key=lambda grade: subjects[grade.subject_id].casefold(),
                        )
                    ],
                    [width * 0.6, width * 0.4],
                ),
            ]
        )
        story.append(
            p(
                "Recorded semester grades only; no averages or overall grades are inferred.",
                muted,
            )
        )
    if include_notes:
        comments = list(
            session.scalars(
                select(HomeschoolDayComment).where(
                    HomeschoolDayComment.household_id == household_id,
                    HomeschoolDayComment.child_id == child_id,
                    HomeschoolDayComment.date >= semester.start_date,
                    HomeschoolDayComment.date <= semester.end_date,
                )
            )
        )
        notes = [
            (
                record.date,
                subjects.get(record.subject_id, "Unavailable subject"),
                record.comment,
            )
            for record in attendance
            if record.comment.strip()
        ]
        notes += [
            (record.date, "Day note", record.comment)
            for record in comments
            if record.comment.strip()
        ]
        if notes:
            story.append(p("Notes", heading))
            for when, label, text in sorted(notes, key=lambda note: (note[0], note[1])):
                story.append(
                    p(
                        f"{when.isoformat()} · {label}",
                        ParagraphStyle("Note label", parent=bold, keepWithNext=True),
                    )
                )
                story.append(p(text))
                story.append(Spacer(1, 5))
    if unsupported_glyphs:
        story.insert(
            3,
            p(
                "Characters unavailable in the report font are shown as Unicode code points, for example [U+4E2D].",
                muted,
            ),
        )
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        leftMargin=48,
        rightMargin=48,
        topMargin=44,
        bottomMargin=48,
        title="Homeschool semester report",
        author="Family Manager",
    )

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.line(48, 34, A4[0] - 48, 34)
        canvas.setFont("HomeschoolSans", 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(48, 22, "Homeschool semester report")
        canvas.drawRightString(A4[0] - 48, 22, str(doc.page))
        canvas.restoreState()

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
