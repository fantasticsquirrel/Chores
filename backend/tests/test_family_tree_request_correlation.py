"""Parent-owned request correlation integration; no content-bearing request IDs."""
import json
import logging
from uuid import UUID

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.error_handling import RequestLoggingMiddleware, register_exception_handlers
from test_family_tree_api import BASE, create, person_id, tree

PRIVATE = "PRIVATE_genealogy_birth_story_password_/secret/path"
UUID_ID = "b12f48ba-cf06-4a73-980f-58f712941a22"
LOGGER = "app.services.family_tree.observability"


@pytest.mark.parametrize("header", [None, PRIVATE, UUID_ID, UUID_ID.upper()])
def test_actual_domain_failure_uses_the_same_safe_id_as_response(tree, caplog, header):
    client, _, _ = tree
    pid = person_id(create(client, name="Synthetic correlation record"))
    client.headers.pop("X-Request-ID", None)
    caplog.set_level(logging.INFO)
    caplog.clear()
    headers = {} if header is None else {"X-Request-ID": header}
    response = client.patch(
        BASE + f"/people/{pid}",
        json={"expected_graph_revision": 0, "changes": {"notes_md": PRIVATE}},
        headers=headers,
    )
    assert response.status_code == 409
    request_id = response.headers["X-Request-ID"]
    try:
        parsed = UUID(request_id)
    except ValueError:
        parsed = None
    assert parsed is not None, "Family Tree correlation must not reflect arbitrary header content"
    assert str(parsed) == request_id
    if header in (UUID_ID, UUID_ID.upper()):
        assert request_id == UUID_ID
    emitted = [json.loads(record.getMessage()) for record in caplog.records if record.name == LOGGER]
    assert emitted and all(event.get("request_id") == request_id for event in emitted)
    assert PRIVATE not in "\n".join(record.getMessage() for record in caplog.records)
    completed = [record.getMessage() for record in caplog.records if record.name == "app.error_handling"]
    assert any(f"request_id={request_id}" in line for line in completed)


def test_legacy_adjacent_request_id_remains_unchanged():
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/adjacent")
    def adjacent(request: Request):
        return {"request_id": request.state.request_id}

    with TestClient(app) as client:
        response = client.get("/adjacent", headers={"X-Request-ID": "legacy-request-id"})
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "legacy-request-id"
    assert response.json() == {"request_id": "legacy-request-id"}


def test_family_tree_exception_boundary_never_logs_untrusted_correlation(caplog):
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)
    register_exception_handlers(app)

    @app.get(BASE + "/correlation-probe")
    def fail():
        raise RuntimeError(PRIVATE)

    caplog.set_level(logging.INFO)
    with TestClient(app) as client:
        response = client.get(BASE + "/correlation-probe", headers={"X-Request-ID": PRIVATE})
    assert response.status_code == 500
    request_id = response.headers["X-Request-ID"]
    assert request_id != PRIVATE
    assert PRIVATE not in caplog.text
    assert any(f"request_id={request_id}" in record.getMessage() for record in caplog.records)
