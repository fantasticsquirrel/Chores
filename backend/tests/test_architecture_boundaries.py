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


def test_removed_backend_compatibility_facades_have_no_live_imports() -> None:
    assert not (ROOT / "backend/app/models/core.py").exists()
    assert not (ROOT / "backend/app/services/notifications.py").exists()
    assert not (ROOT / "backend/app/services/chores/workflow.py").exists()

    source_roots = (ROOT / "backend/app", ROOT / "backend/tests", ROOT / "backend/scripts")
    sources = "\n".join(
        path.read_text(encoding="utf-8")
        for source_root in source_roots
        for path in source_root.rglob("*.py")
        if path != Path(__file__)
    )
    assert "app.models.core" not in sources
    assert "app.services.notifications" not in sources
    assert "app.services.chores.workflow" not in sources


def test_chore_router_keeps_transaction_ownership_and_delegates_domain_logic() -> None:
    chore_router = (ROOT / "backend/app/api/chores.py").read_text(encoding="utf-8")
    chore_services = [
        (ROOT / f"backend/app/services/chores/{name}.py").read_text(encoding="utf-8")
        for name in ("management", "parent_tasks", "serialization")
    ]

    assert len(chore_router.splitlines()) < 300
    assert "from app.services.chores.management import" in chore_router
    assert "from sqlalchemy import" not in chore_router
    assert "session.commit()" in chore_router
    assert "session.get(Chore" not in chore_services[0]
    for service in chore_services:
        assert "session.commit()" not in service
        assert "app.api" not in service
        assert len(service.splitlines()) < 350


def test_homeschool_router_keeps_security_and_transaction_boundaries_while_delegating_crud() -> None:
    homeschool_router = (ROOT / "backend/app/api/homeschool.py").read_text(encoding="utf-8")
    service_root = ROOT / "backend/app/services/homeschool"
    homeschool_services = [
        (service_root / f"{name}.py").read_text(encoding="utf-8")
        for name in ("access", "semesters", "subjects", "attendance", "day_comments", "grades")
    ]

    assert len(homeschool_router.splitlines()) < 300
    assert "require_module_access(MODULE_HOMESCHOOL" in homeschool_router
    assert "Depends(_require_homeschool_access)" in homeschool_router
    assert "from app.services.homeschool" in homeschool_router
    assert "from sqlalchemy import" not in homeschool_router
    assert "session.get(" not in homeschool_router
    assert "session.commit()" in homeschool_router
    assert "session.rollback()" in homeschool_router
    assert "session.refresh(" in homeschool_router
    for service in homeschool_services:
        assert "app.api" not in service
        assert "session.commit()" not in service
        assert "session.rollback()" not in service
        assert "session.refresh(" not in service
        assert "session.get(" not in service
        assert len(service.splitlines()) < 250


def test_recipe_router_keeps_security_and_transaction_boundaries_while_delegating_domain_logic() -> None:
    recipe_router = (ROOT / "backend/app/api/recipes.py").read_text(encoding="utf-8")
    service_root = ROOT / "backend/app/services/recipes"
    recipe_services = {
        name: (service_root / f"{name}.py").read_text(encoding="utf-8")
        for name in (
            "backup",
            "catalog",
            "feedback",
            "importer",
            "management",
            "ownership",
            "scaling",
            "serialization",
            "service",
        )
    }

    assert len(recipe_router.splitlines()) < 300
    assert "require_module_access(MODULE_RECIPES" in recipe_router
    assert recipe_router.count("Depends(_require_recipes_access)") == recipe_router.count("@router.")
    assert "from app.services.recipes.backup import" in recipe_router
    assert "from app.services.recipes.importer import stage_recipe_url_import" in recipe_router
    assert "from app.services.recipes.serialization import" in recipe_router
    assert "from sqlalchemy import" not in recipe_router
    assert "select(" not in recipe_router
    assert "session.commit()" in recipe_router
    assert "session.rollback()" in recipe_router
    assert "session.refresh(" in recipe_router
    assert recipe_router.index('@router.post("/import-url"') < recipe_router.index('@router.get("/{recipe_id}"')
    assert recipe_router.index('@router.get("/backup"') < recipe_router.index('@router.get("/{recipe_id}"')

    for service in recipe_services.values():
        assert "app.api" not in service
        assert "session.commit()" not in service
        assert "session.rollback()" not in service
        assert "session.refresh(" not in service
        assert len(service.splitlines()) < 350

    assert ".where(Recipe.household_id == actor.household_id)" in recipe_services["backup"]
    assert ".order_by(Recipe.title)" in recipe_services["backup"]
    assert "for recipe_payload in payload.recipes" in recipe_services["backup"]
    assert 'parsed.scheme not in {"http", "https"}' in recipe_services["importer"]
    assert "socket.getaddrinfo(" in recipe_services["importer"]
    assert "ip.is_private" in recipe_services["importer"]
    assert "MAX_RECIPE_IMPORT_BYTES" in recipe_services["importer"]
    assert "RECIPE_IMPORT_TIMEOUT_SECONDS" in recipe_services["importer"]


def test_ops_router_keeps_privileged_security_and_transaction_boundaries_while_delegating_domains() -> None:
    ops_router = (ROOT / "backend/app/api/ops.py").read_text(encoding="utf-8")
    service_root = ROOT / "backend/app/services/ops"
    ops_services = {
        name: (service_root / f"{name}.py").read_text(encoding="utf-8")
        for name in (
            "audit",
            "billing_reconciliation",
            "platform_users",
            "support_cases",
        )
    }

    assert len(ops_router.splitlines()) < 300
    assert ops_router.count("Depends(require_platform_roles(") == 9
    assert "has_recent_reauth(principal.auth_session)" in ops_router
    assert "from app.services.ops import audit, billing_reconciliation, platform_users, support_cases" in ops_router
    assert "from sqlalchemy import" not in ops_router
    assert "select(" not in ops_router
    assert "db.commit()" in ops_router

    for service in ops_services.values():
        assert "app.api" not in service
        assert "session.commit()" not in service
        assert "session.rollback()" not in service
        assert "session.refresh(" not in service
        assert len(service.splitlines()) < 300
