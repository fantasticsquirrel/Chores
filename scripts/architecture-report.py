#!/usr/bin/env python3
"""Report architectural hotspots and dependency-boundary exceptions."""

from __future__ import annotations

import argparse
import ast
import json
from dataclasses import asdict, dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOTS = (ROOT / "backend/app", ROOT / "frontend/src", ROOT / "mobile/src", ROOT / "packages/family-api/src")
EXTENSIONS = {".py", ".ts", ".tsx"}

HOTSPOT_ALLOWLIST = {
    "backend/app/services/chores/workflow.py": "Phase 2 chore-domain split",
    "backend/app/services/notifications.py": "Phase 2 notification split",
    "frontend/src/pages/ParentChoresPage.tsx": "Phase 5 web feature split",
    "frontend/src/pages/ParentChildrenPage.tsx": "Phase 5 web feature split",
    "frontend/src/pages/AdminDashboardPage.tsx": "Phase 5 web feature split",
    "mobile/src/screens/homeschool/HomeschoolScreen.tsx": "Phase 6 mobile feature split",
    "mobile/src/features/homeschool/components/HomeschoolForms.tsx": "Phase 6 mobile feature split",
    "mobile/src/screens/parent/ChoresScreen.tsx": "Phase 6 mobile feature split",
    "mobile/src/screens/parent/ChildrenScreen.tsx": "Phase 6 mobile feature split",
    "mobile/src/styles/layout.ts": "Phase 6 style split",
    "packages/family-api/src/models.ts": "Phase 4 contract split",
    "packages/family-api/src/api-endpoints.ts": "Phase 4 endpoint split",
}

PRIVATE_IMPORT_ALLOWLIST = {
    ("backend/app/services/notifications.py", "app.services.chores.workflow._eligible_chores_for_child"):
        "Phase 2 replaces this with a public eligibility boundary",
    ("backend/app/api/workflow.py", "app.services.chores.workflow._advance_rotation_state_if_needed"):
        "Phase 2 replaces this with a public rotation boundary",
    ("backend/app/api/workflow.py", "app.services.chores.workflow._approval_occurrence_or_409"):
        "Phase 2 replaces this with a public submission boundary",
    ("backend/app/api/workflow.py", "app.services.chores.workflow._derive_submission_status"):
        "Phase 2 replaces this with a public submission boundary",
    ("backend/app/api/workflow.py", "app.services.chores.workflow._eligible_chores_for_child"):
        "Phase 2 replaces this with a public eligibility boundary",
    ("backend/app/api/workflow.py", "app.services.chores.workflow._resolve_active_child"):
        "Phase 2 replaces this with a public child-scope boundary",
    ("backend/app/api/workflow.py", "app.services.chores.workflow._serialize_submission_review"):
        "Phase 2 replaces this with a public serialization boundary",
}


@dataclass(frozen=True)
class Hotspot:
    path: str
    lines: int
    allowed_until: str | None


@dataclass(frozen=True)
class Violation:
    path: str
    dependency: str
    reason: str


def source_files() -> list[Path]:
    return sorted(
        path
        for root in SOURCE_ROOTS
        for path in root.rglob("*")
        if path.is_file() and path.suffix in EXTENSIONS and "__pycache__" not in path.parts
    )


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def line_count(path: Path) -> int:
    with path.open("r", encoding="utf-8") as source:
        return sum(1 for _ in source)


def python_imports(path: Path) -> list[tuple[str, str]]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    imports: list[tuple[str, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend((alias.name, alias.name) for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.extend((node.module, f"{node.module}.{alias.name}") for alias in node.names)
    return imports


def build_report() -> dict[str, object]:
    hotspots: list[Hotspot] = []
    violations: list[Violation] = []
    for path in source_files():
        rel = relative(path)
        lines = line_count(path)
        if lines > 350 and ".test." not in path.name and not rel.startswith("backend/tests/"):
            hotspots.append(Hotspot(rel, lines, HOTSPOT_ALLOWLIST.get(rel)))

        if path.suffix != ".py":
            continue
        for module, dependency in python_imports(path):
            if rel.startswith("backend/app/services/") and module.startswith("app.api"):
                violations.append(Violation(rel, dependency, "service imports API layer"))
            if dependency.rsplit(".", 1)[-1].startswith("_"):
                key = (rel, dependency)
                if key not in PRIVATE_IMPORT_ALLOWLIST:
                    violations.append(Violation(rel, dependency, "cross-module private import"))

    unplanned = [asdict(item) for item in hotspots if item.allowed_until is None and item.lines > 500]
    return {
        "hotspots": [asdict(item) for item in sorted(hotspots, key=lambda item: item.lines, reverse=True)],
        "unplanned_hotspots_over_500": unplanned,
        "violations": [asdict(item) for item in violations],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()
    report = build_report()
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print("Architecture hotspots (>350 lines)")
        for item in report["hotspots"]:
            marker = item["allowed_until"] or "UNPLANNED"
            print(f"{item['lines']:>5}  {item['path']}  [{marker}]")
        print(f"\nBoundary violations: {len(report['violations'])}")
        for item in report["violations"]:
            print(f"- {item['path']}: {item['dependency']} ({item['reason']})")
    if args.strict and (report["violations"] or report["unplanned_hotspots_over_500"]):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
