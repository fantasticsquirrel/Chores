from fastapi.testclient import TestClient
from sqlalchemy import select, func
from app.main import app
from app.models import Child
from app.models.discovery import DiscoveryExplorationAccess
from test_discovery_api import actors, login  # noqa: F401


def test_inactive_child_is_not_manageable_or_listed(actors):
    factory, parent, child, kid, _, _ = actors
    with factory() as session:
        session.get(Child, kid).active = False
        session.commit()
    with TestClient(app) as client:
        headers = login(client, parent)
        assert kid not in [
            item["id"] for item in client.get("/chore-api/discovery/children").json()
        ]
        assert (
            client.get(f"/chore-api/discovery/children/{kid}/access").status_code == 404
        )
        assert (
            client.put(
                f"/chore-api/discovery/children/{kid}/access",
                json={"enabled": False, "exploration_ids": ["gravity"]},
                headers=headers,
            ).status_code
            == 404
        )


def test_invalid_bulk_is_atomic_and_another_child_unchanged(actors):
    factory, parent, _, kid, sibling, other = actors
    with TestClient(app) as client:
        headers = login(client, parent)
        for target, payload in [
            (kid, {"enabled": False, "exploration_ids": ["gravity", "unknown"]}),
            (
                kid,
                {
                    "enabled": False,
                    "exploration_ids": ["gravity"],
                    "tag": "nonexistent",
                },
            ),
            (other, {"enabled": False, "exploration_ids": ["gravity"]}),
        ]:
            assert client.put(
                f"/chore-api/discovery/children/{target}/access",
                json=payload,
                headers=headers,
            ).status_code in {404, 422}
        with factory() as session:
            assert (
                session.scalar(
                    select(func.count()).select_from(DiscoveryExplorationAccess)
                )
                == 0
            )
        assert (
            client.put(
                f"/chore-api/discovery/children/{kid}/access",
                json={"enabled": False, "exploration_ids": ["gravity"]},
                headers=headers,
            ).status_code
            == 200
        )
        sibling_access = client.get(
            f"/chore-api/discovery/children/{sibling}/access"
        ).json()
        assert all(
            item["enabled"] and item["override"] is None
            for item in sibling_access["explorations"]
        )
