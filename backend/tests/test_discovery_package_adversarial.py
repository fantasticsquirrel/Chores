"""Independent adversarial checks, using disposable fixture databases only."""

import base64
import copy
import io
import json
import stat
import zipfile
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app
from app.models import User, Child
from app.models.enums import UserRole
from app.security import hash_password
from app.services.discovery.packages import validate_archive
from app.services.modules import ModuleService
from test_discovery_packages import manifest, archive
from test_discovery_api import actors, login  # noqa: F401


def encoded_entries(entries):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_STORED) as z:
        for name, data in entries:
            z.writestr(name, data)
    return base64.b64encode(output.getvalue()).decode()


@pytest.mark.parametrize(
    "value", [b'{"a":1,"a":2}', b"\xff", b'{"a":NaN}', b"[" * 2000 + b"]" * 2000]
)
def test_hostile_manifest_json_returns_validation_error(value):
    with pytest.raises(HTTPException) as error:
        validate_archive(encoded_entries([("manifest.json", value)]))
    assert error.value.status_code == 422


def test_symlink_path_rejected():
    link = zipfile.ZipInfo("escape.txt")
    link.create_system = 3
    link.external_attr = (stat.S_IFLNK | 0o777) << 16
    with pytest.raises(HTTPException):
        validate_archive(
            encoded_entries(
                [("manifest.json", json.dumps(manifest())), (link, "../target")]
            )
        )


def test_cross_household_and_manage_revocation(actors):
    factory, parent, child, kid, sibling, other = actors
    with factory() as session:
        foreign_household = session.get(Child, other).household_id
        foreign = User(
            household_id=foreign_household,
            email="foreign-parent@test.com",
            role=UserRole.PARENT,
            password_hash=hash_password("password123"),
        )
        session.add(foreign)
        ModuleService().set_household_access(
            session,
            household_id=foreign_household,
            module_key="discovery-lab",
            enabled=True,
        )
        session.commit()
    root = "/chore-api/discovery"
    with TestClient(app) as client:
        headers = login(client, parent)
        assert (
            client.post(
                root + "/packages", json={"archive_base64": archive()}, headers=headers
            ).status_code
            == 201
        )
        assert (
            client.post(
                root + "/packages/uploaded-lab/versions/1.0.0/publish", headers=headers
            ).status_code
            == 200
        )
        headers = login(client, foreign)
        assert client.get(root + "/packages").json() == []
        assert (
            client.get(root + "/packages/uploaded-lab/versions/1.0.0").status_code
            == 404
        )
        assert (
            client.post(
                root + "/packages/uploaded-lab/versions/1.0.0/publish", headers=headers
            ).status_code
            == 404
        )
        assert (
            client.get(root + "/explorations/uploaded-lab/package").status_code == 404
        )
        with factory() as session:
            ModuleService().set_user_access(
                session, session.get(User, parent.id), "discovery-lab", True, False
            )
            session.commit()
        headers = login(client, parent)
        assert client.get(root + "/packages").status_code == 403
        assert (
            client.get(root + "/packages/uploaded-lab/versions/1.0.0").status_code
            == 403
        )
        assert (
            client.post(
                root + "/packages/uploaded-lab/versions/1.0.0/publish", headers=headers
            ).status_code
            == 403
        )
        assert (
            client.post(
                root + "/packages", json={"archive_base64": archive()}, headers=headers
            ).status_code
            == 403
        )


def test_child_grant_and_module_revocation_fail_closed(actors):
    factory, parent, child, kid, _, _ = actors
    root = "/chore-api/discovery"
    with TestClient(app) as client:
        headers = login(client, parent)
        client.post(
            root + "/packages", json={"archive_base64": archive()}, headers=headers
        ).raise_for_status()
        client.post(
            root + "/packages/uploaded-lab/versions/1.0.0/publish", headers=headers
        ).raise_for_status()
        client.put(
            f"{root}/children/{kid}/access",
            json={
                "enabled": True,
                "exploration_ids": ["uploaded-lab"],
                "package_versions": {"uploaded-lab": "1.0.0"},
            },
            headers=headers,
        ).raise_for_status()
        login(client, child)
        assert (
            client.get(root + "/explorations/uploaded-lab/package").status_code == 200
        )
        headers = login(client, parent)
        client.put(
            f"{root}/children/{kid}/access",
            json={"enabled": False, "exploration_ids": ["uploaded-lab"]},
            headers=headers,
        ).raise_for_status()
        login(client, child)
        assert (
            client.get(root + "/explorations/uploaded-lab/package").status_code == 403
        )
        with factory() as session:
            ModuleService().set_household_access(
                session,
                household_id=parent.household_id,
                module_key="discovery-lab",
                enabled=False,
            )
            session.commit()
        login(client, parent)
        assert client.get(root + "/packages").status_code == 403
        assert (
            client.get(root + "/explorations/uploaded-lab/package").status_code == 403
        )


def test_stale_review_cannot_approve_new_version(actors):
    _, parent, child, kid, _, _ = actors
    root = "/chore-api/discovery"
    with TestClient(app) as client:
        headers = login(client, parent)
        for version in ("1.0.0", "2.0.0"):
            client.post(
                root + "/packages",
                json={"archive_base64": archive(manifest(version))},
                headers=headers,
            ).raise_for_status()
            client.post(
                root + f"/packages/uploaded-lab/versions/{version}/publish",
                headers=headers,
            ).raise_for_status()
        response = client.put(
            f"{root}/children/{kid}/access",
            json={
                "enabled": True,
                "exploration_ids": ["uploaded-lab"],
                "package_versions": {"uploaded-lab": "1.0.0"},
            },
            headers=headers,
        )
        assert response.status_code == 409
        login(client, child)
        assert (
            client.get(root + "/explorations/uploaded-lab/package").status_code == 403
        )


def test_inverse_finite_inputs_cannot_produce_infinite_output():
    value = manifest()
    value["scene"]["kind"] = "inverse"
    control = value["scene"]["controls"][0]
    control.update(min=1e-320, max=1, initial=1, step=0.01)
    with pytest.raises(HTTPException):
        validate_archive(archive(value))


def test_nested_manifest_extras_are_rejected():
    value = copy.deepcopy(manifest())
    value["exploration"]["experiments"][0]["unknown"] = "should not be silently ignored"
    with pytest.raises(HTTPException):
        validate_archive(archive(value))
