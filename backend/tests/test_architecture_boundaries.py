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


def test_api_and_notification_reminders_use_public_chore_boundaries() -> None:
    workflow_api = (ROOT / "backend/app/api/workflow.py").read_text(encoding="utf-8")
    reminders = (ROOT / "backend/app/services/notification_reminders.py").read_text(encoding="utf-8")

    assert "app.services.chores.workflow import" not in workflow_api
    assert "app.services.chores.eligibility import eligible_chores_for_child" in reminders


def test_notification_services_do_not_depend_on_api_or_facade_layers() -> None:
    for service_name in (
        "notification_creation.py",
        "notification_push.py",
        "notification_reminders.py",
        "notification_submissions.py",
    ):
        service = (ROOT / "backend/app/services" / service_name).read_text(encoding="utf-8")

        assert "app.api" not in service
        assert "app.services.notifications" not in service


def test_notification_facade_exposes_extracted_capabilities_without_orchestration() -> None:
    notifications = (ROOT / "backend/app/services/notifications.py").read_text(encoding="utf-8")

    assert "from app.services.notification_creation import" in notifications
    assert "from app.services.notification_push import" in notifications
    assert "from app.services.notification_reminders import" in notifications
    assert "from app.services.notification_submissions import" in notifications
    assert "from sqlalchemy" not in notifications
    assert "def create_notification" not in notifications
    assert "def notify_submission_created" not in notifications
    assert "def notify_submission_approved" not in notifications
    assert "def generate_daily_chore_reminders" not in notifications
    assert "def run_notification_scheduler" not in notifications
    assert "def process_pending_push_deliveries" not in notifications
