import copy
import base64
import io
import json
import zipfile
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app
from app.services.discovery import catalog
from app.services.discovery.packages import validate_archive
from test_discovery_api import actors, login  # noqa: F401


def manifest(version="1.0.0"):
    exploration = copy.deepcopy(catalog()[0])
    exploration.pop("package", None)
    exploration["id"] = "uploaded-lab"
    return {
        "schema_version": 1,
        "package_id": "uploaded-lab",
        "version": version,
        "runtime": "declarative-v1",
        "exploration": exploration,
        "assets": [],
        "scene": {
            "kind": "proportional",
            "controls": [
                {
                    "id": "input",
                    "label": "Input",
                    "min": 1,
                    "max": 10,
                    "step": 1,
                    "initial": 2,
                    "unit": "m",
                }
            ],
            "output": {"label": "Output", "unit": "m"},
            "coefficient": 2,
        },
    }


def archive(value=None, extra=()):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps(value or manifest()))
        for name, content in extra:
            z.writestr(name, content)
    return base64.b64encode(output.getvalue()).decode()


def test_valid_archive():
    result = validate_archive(archive())
    assert result["manifest"]["package_id"] == "uploaded-lab"
    assert len(result["checksum"]) == 64


@pytest.mark.parametrize(
    "path",
    [
        "../escape.js",
        "/absolute.js",
        "a/../x.js",
        "a\\b.js",
        "C:/x.js",
        "index.html",
        "a//b.js",
    ],
)
def test_unsafe_or_undeclared_files(path):
    with pytest.raises(HTTPException):
        validate_archive(archive(extra=[(path, "x")]))


def test_duplicate_checksum_schema_and_bomb_rejected():
    with pytest.raises(HTTPException):
        validate_archive(archive(extra=[("manifest.json", "{}")]))
    bad = manifest()
    bad["unknown"] = True
    with pytest.raises(HTTPException):
        validate_archive(archive(bad))
    bad = manifest()
    bad["exploration"]["title"] = "<script>alert(1)</script>"
    with pytest.raises(HTTPException):
        validate_archive(archive(bad))
    bad = manifest()
    bad["runtime"] = "worker-v1"
    del bad["scene"]
    bad["entry"] = "main.js"
    bad["assets"] = [
        {"path": "main.js", "mime_type": "text/javascript", "sha256": "0" * 64}
    ]
    with pytest.raises(HTTPException):
        validate_archive(archive(bad, [("main.js", "postMessage({})")]))
    with pytest.raises(HTTPException):
        validate_archive(archive(extra=[("huge.txt", "x" * 2_000_001)]))


def test_publish_child_version_approval_and_rollback(actors):
    _, parent, child, kid, _, _ = actors
    root = "/chore-api/discovery"
    with TestClient(app) as client:
        headers = login(client, parent)
        assert (
            client.post(
                root + "/packages", json={"archive_base64": archive()}, headers=headers
            ).status_code
            == 201
        )
        assert len(client.get(root + "/explorations").json()) == 26
        assert (
            client.post(
                root + "/packages", json={"archive_base64": archive()}, headers=headers
            ).status_code
            == 409
        )
        assert (
            client.get(root + "/packages/uploaded-lab/versions/1.0.0").json()[
                "manifest"
            ]["version"]
            == "1.0.0"
        )
        assert (
            client.post(
                root + "/packages/uploaded-lab/versions/1.0.0/publish", headers=headers
            ).status_code
            == 200
        )
        assert len(client.get(root + "/explorations").json()) == 27
        login(client, child)
        assert len(client.get(root + "/explorations").json()) == 26
        assert (
            client.get(root + "/explorations/uploaded-lab/package").status_code == 403
        )
        headers = login(client, parent)
        approved = client.put(
            f"{root}/children/{kid}/access",
            json={
                "enabled": True,
                "tag": manifest()["exploration"]["tags"][0],
                "package_versions": {"uploaded-lab": "1.0.0"},
            },
            headers=headers,
        )
        assert approved.status_code == 200
        login(client, child)
        delivered = client.get(root + "/explorations/uploaded-lab/package")
        assert delivered.status_code == 200
        assert delivered.headers["cache-control"] == "no-store"
        headers = login(client, parent)
        assert (
            client.post(
                root + "/packages",
                json={"archive_base64": archive(manifest("2.0.0"))},
                headers=headers,
            ).status_code
            == 201
        )
        assert (
            client.post(
                root + "/packages/uploaded-lab/versions/2.0.0/publish", headers=headers
            ).status_code
            == 200
        )
        login(client, child)
        assert (
            client.get(root + "/explorations/uploaded-lab/package").status_code == 403
        )
        headers = login(client, parent)
        assert (
            client.post(
                root + "/packages/uploaded-lab/versions/1.0.0/publish", headers=headers
            ).status_code
            == 200
        )
        login(client, child)
        assert (
            client.get(root + "/explorations/uploaded-lab/package").status_code == 403
        )


def test_package_permissions_and_scope(actors):
    factory, parent, child, kid, sibling, other = actors
    root = "/chore-api/discovery"
    with TestClient(app) as client:
        assert client.get(root + "/packages").status_code == 401
        headers = login(client, child)
        assert (
            client.post(
                root + "/packages", json={"archive_base64": archive()}, headers=headers
            ).status_code
            == 403
        )
        assert client.get(root + "/packages").status_code == 403
        headers = login(client, parent)
        assert (
            client.post(
                root + "/packages", json={"archive_base64": archive()}
            ).status_code
            == 403
        )
        assert client.get(root + "/packages/unknown/versions/1.0.0").status_code == 404


def test_worker_entry_is_verified_and_delivered_as_data():
    import hashlib

    value = manifest()
    value.pop("scene")
    value.update(runtime="worker-v1", entry="main.js")
    code = b'postMessage({type:"ready"});'
    value["assets"] = [
        {
            "path": "main.js",
            "mime_type": "text/javascript",
            "sha256": hashlib.sha256(code).hexdigest(),
        }
    ]
    validated = validate_archive(archive(value, [("main.js", code)]))
    assert base64.b64decode(validated["assets"][0]["content_base64"]) == code
    value["assets"][0]["mime_type"] = "text/plain"
    with pytest.raises(HTTPException):
        validate_archive(archive(value, [("main.js", code)]))


def test_worker_entry_and_image_signature_limits():
    import hashlib

    value = manifest()
    value.pop("scene")
    value.update(runtime="worker-v1", entry="main.js")
    # Stored ZIP avoids compression-ratio rejection and isolates entry limit.
    code = b" " * 262145
    value["assets"] = [
        {
            "path": "main.js",
            "mime_type": "text/javascript",
            "sha256": hashlib.sha256(code).hexdigest(),
        }
    ]
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as z:
        z.writestr("manifest.json", json.dumps(value))
        z.writestr("main.js", code)
    with pytest.raises(HTTPException, match="256 KiB"):
        validate_archive(base64.b64encode(output.getvalue()).decode())
    value = manifest()
    code = b'<svg onload="alert(1)"></svg>'
    value["assets"] = [
        {
            "path": "photo.png",
            "mime_type": "image/png",
            "sha256": hashlib.sha256(code).hexdigest(),
        }
    ]
    with pytest.raises(HTTPException):
        validate_archive(archive(value, [("photo.png", code)]))


def test_streamed_body_limit_precedes_json_parser():
    import asyncio
    from app.security.discovery_limits import (
        DiscoveryBodyLimitMiddleware,
        MAX_UPLOAD_BODY,
    )

    async def check():
        entered = []
        sent = []

        async def downstream(*args):
            entered.append(True)

        events = iter(
            [
                {
                    "type": "http.request",
                    "body": b"x" * (MAX_UPLOAD_BODY // 2),
                    "more_body": True,
                },
                {
                    "type": "http.request",
                    "body": b"x" * (MAX_UPLOAD_BODY // 2 + 1),
                    "more_body": False,
                },
            ]
        )

        async def receive():
            return next(events)

        async def send(event):
            sent.append(event)

        await DiscoveryBodyLimitMiddleware(downstream)(
            {
                "type": "http",
                "path": "/chore-api/discovery/packages",
                "method": "POST",
                "headers": [],
            },
            receive,
            send,
        )
        assert not entered and sent[0]["status"] == 413

    asyncio.run(check())


def test_publish_audit_and_approval_are_household_scoped(actors):
    from sqlalchemy import select
    from app.models import SecurityAuditEvent

    factory, parent, _, kid, _, _ = actors
    root = "/chore-api/discovery"
    with TestClient(app) as client:
        headers = login(client, parent)
        client.post(
            root + "/packages", json={"archive_base64": archive()}, headers=headers
        ).raise_for_status()
        client.post(
            root + "/packages/uploaded-lab/versions/1.0.0/publish", headers=headers
        ).raise_for_status()
    with factory() as session:
        events = session.scalars(
            select(SecurityAuditEvent).where(
                SecurityAuditEvent.event_type.in_(
                    ["discovery.package.uploaded", "discovery.package.published"]
                )
            )
        ).all()
        assert len(events) == 2
        assert all(event.household_id == parent.household_id for event in events)
