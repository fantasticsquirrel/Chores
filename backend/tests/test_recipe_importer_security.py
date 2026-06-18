from __future__ import annotations

import urllib.error

import pytest
from fastapi import HTTPException

from app.schemas.recipes import CreateRecipeRequest
from app.services.recipes.importer import fetch_recipe_payload_from_url, recipe_payload_from_html


def test_recipe_importer_blocks_localhost_before_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_urlopen(*args: object, **kwargs: object) -> object:
        raise AssertionError("network should not be called for blocked hosts")

    monkeypatch.setattr("app.services.recipes.importer.urllib.request.urlopen", fail_urlopen)

    with pytest.raises(HTTPException) as exc:
        fetch_recipe_payload_from_url("http://localhost/secret")

    assert exc.value.status_code == 400
    assert "not allowed" in str(exc.value.detail)


@pytest.mark.parametrize(
    "url",
    [
        "ftp://example.com/recipe",
        "http://127.0.0.1/recipe",
        "http://10.0.0.5/recipe",
        "http://169.254.169.254/latest/meta-data",
        "http://[::1]/recipe",
    ],
)
def test_recipe_importer_rejects_unsafe_urls_without_fetch(url: str, monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_urlopen(*args: object, **kwargs: object) -> object:
        raise AssertionError("network should not be called for unsafe URLs")

    monkeypatch.setattr("app.services.recipes.importer.urllib.request.urlopen", fail_urlopen)

    with pytest.raises(HTTPException):
        fetch_recipe_payload_from_url(url)


def test_recipe_importer_blocks_private_dns_resolution(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_getaddrinfo(*args: object, **kwargs: object) -> list[tuple[object, object, object, object, tuple[str, int]]]:
        return [(None, None, None, None, ("192.168.1.10", 443))]

    def fail_urlopen(*args: object, **kwargs: object) -> object:
        raise AssertionError("network should not be called after unsafe DNS resolution")

    monkeypatch.setattr("app.services.recipes.importer.socket.getaddrinfo", fake_getaddrinfo)
    monkeypatch.setattr("app.services.recipes.importer.urllib.request.urlopen", fail_urlopen)

    with pytest.raises(HTTPException) as exc:
        fetch_recipe_payload_from_url("https://recipes.example.test/soup")

    assert exc.value.status_code == 400


def test_recipe_importer_converts_network_errors_to_bad_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.recipes.importer.socket.getaddrinfo", lambda *args, **kwargs: [(None, None, None, None, ("93.184.216.34", 443))])

    def fake_urlopen(*args: object, **kwargs: object) -> object:
        raise urllib.error.URLError("boom")

    monkeypatch.setattr("app.services.recipes.importer.urllib.request.urlopen", fake_urlopen)

    with pytest.raises(HTTPException) as exc:
        fetch_recipe_payload_from_url("https://example.com/recipe")

    assert exc.value.status_code == 400
    assert exc.value.detail == "Could not fetch recipe URL."


def test_recipe_json_ld_parser_maps_recipe_payload() -> None:
    html = '''<html><script type="application/ld+json">{"@type":"Recipe","name":"Soup","description":"Warm","recipeYield":"4 servings","recipeIngredient":["1 cup broth"],"recipeInstructions":[{"text":"Simmer."}]}</script></html>'''

    payload = recipe_payload_from_html(html, "https://example.com/soup")

    assert isinstance(payload, CreateRecipeRequest)
    assert payload.title == "Soup"
    assert payload.servings == 4
    assert payload.ingredients[0].item == "1 cup broth"
    assert payload.steps[0].instruction == "Simmer."
