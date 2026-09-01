from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)


class ZammadUnavailable(RuntimeError):
    pass


class ZammadClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _request(self, method: str, path: str, *, json: dict[str, Any] | None = None) -> Any:
        try:
            response = httpx.request(
                method,
                f"{self.settings.zammad_base_url}/api/v1{path}",
                headers={"Authorization": f"Token token={self.settings.zammad_api_token}", "Accept": "application/json"},
                json=json,
                timeout=httpx.Timeout(self.settings.zammad_timeout_seconds),
                follow_redirects=False,
            )
            response.raise_for_status()
            return response.json() if response.content else {}
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("zammad.request_failed method=%s path=%s error_type=%s", method, path, type(exc).__name__)
            raise ZammadUnavailable("Ticket service is temporarily unavailable.") from exc

    def create_ticket(self, *, title: str, body: str, customer_email: str, fields: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/tickets", json={
            "title": title,
            "group_id": self.settings.zammad_group_id,
            "customer": customer_email,
            "article": {"subject": title, "body": body, "type": "note", "internal": False},
            **fields,
        })

    def get_ticket(self, ticket_id: int) -> dict[str, Any]:
        return self._request("GET", f"/tickets/{ticket_id}")

    def get_articles(self, ticket_id: int) -> list[dict[str, Any]]:
        result = self._request("GET", f"/ticket_articles/by_ticket/{ticket_id}")
        return result if isinstance(result, list) else []

    def reply(self, ticket_id: int, body: str) -> dict[str, Any]:
        return self._request("PUT", f"/tickets/{ticket_id}", json={"article": {"body": body, "type": "note", "internal": False}})

