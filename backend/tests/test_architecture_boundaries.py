from pathlib import Path
import runpy


ROOT = Path(__file__).resolve().parents[2]
REPORT = runpy.run_path(str(ROOT / "scripts" / "architecture-report.py"))


def test_architecture_has_no_unapproved_dependency_violations() -> None:
    report = REPORT["build_report"]()
    assert report["violations"] == []


def test_every_file_over_500_lines_has_a_removal_phase() -> None:
    report = REPORT["build_report"]()
    assert report["unplanned_hotspots_over_500"] == []


def test_api_and_notifications_use_public_chore_boundaries() -> None:
    workflow_api = (ROOT / "backend/app/api/workflow.py").read_text(encoding="utf-8")
    notifications = (ROOT / "backend/app/services/notifications.py").read_text(encoding="utf-8")

    assert "app.services.chores.workflow import" not in workflow_api
    assert "app.services.chores.eligibility import eligible_chores_for_child" in notifications
