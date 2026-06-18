from __future__ import annotations

import ipaddress
import json
import re
import socket
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from typing import Any

from fastapi import HTTPException, status

from app.schemas.recipes import CreateRecipeRequest

MAX_RECIPE_IMPORT_BYTES = 2_000_000
RECIPE_IMPORT_TIMEOUT_SECONDS = 10
RECIPE_IMPORT_USER_AGENT = "FamilyManagerRecipeImporter/1.0"


class JsonLdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._inside_json_ld = False
        self.blocks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "script":
            return
        attr_map = {name.lower(): value for name, value in attrs}
        script_type = attr_map.get("type") or ""
        self._inside_json_ld = script_type.lower() == "application/ld+json"

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script":
            self._inside_json_ld = False

    def handle_data(self, data: str) -> None:
        if self._inside_json_ld:
            self.blocks.append(data)


def first_text(value: Any) -> str:
    if isinstance(value, list):
        return first_text(value[0]) if value else ""
    if isinstance(value, dict):
        return str(value.get("name") or value.get("text") or "")
    return str(value or "")


def find_recipe_json_ld(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        graph = value.get("@graph")
        if graph is not None:
            found = find_recipe_json_ld(graph)
            if found is not None:
                return found
        raw_type = value.get("@type")
        types = raw_type if isinstance(raw_type, list) else [raw_type]
        if any(str(item).lower() == "recipe" for item in types):
            return value
        for child in value.values():
            found = find_recipe_json_ld(child)
            if found is not None:
                return found
    if isinstance(value, list):
        for child in value:
            found = find_recipe_json_ld(child)
            if found is not None:
                return found
    return None


def recipe_payload_from_json_ld(recipe_data: dict[str, Any], source_url: str) -> CreateRecipeRequest:
    raw_ingredients = recipe_data.get("recipeIngredient") or recipe_data.get("ingredients") or []
    if isinstance(raw_ingredients, str):
        raw_ingredients = [line.strip() for line in raw_ingredients.split("\n") if line.strip()]
    ingredients = [
        {"position": index, "item": str(item).strip()[:255]}
        for index, item in enumerate(raw_ingredients if isinstance(raw_ingredients, list) else [], start=1)
        if str(item).strip()
    ]

    raw_steps = recipe_data.get("recipeInstructions") or []
    if isinstance(raw_steps, str):
        raw_steps = [line.strip() for line in re.split(r"\n+", raw_steps) if line.strip()]
    steps: list[dict[str, object]] = []
    if isinstance(raw_steps, list):
        for item in raw_steps:
            if isinstance(item, dict) and isinstance(item.get("itemListElement"), list):
                for nested in item["itemListElement"]:
                    text = first_text(nested).strip()
                    if text:
                        steps.append({"position": len(steps) + 1, "instruction": text[:2000]})
            else:
                text = first_text(item).strip()
                if text:
                    steps.append({"position": len(steps) + 1, "instruction": text[:2000]})

    image = recipe_data.get("image")
    photo_url = first_text(image).strip() or None
    servings_text = first_text(recipe_data.get("recipeYield") or recipe_data.get("yield")).strip()
    serving_match = re.search(r"\d+(?:\.\d+)?", servings_text)
    servings = float(serving_match.group(0)) if serving_match else None
    title = first_text(recipe_data.get("name")).strip() or "Imported Recipe"
    description = first_text(recipe_data.get("description")).strip()

    return CreateRecipeRequest.model_validate(
        {
            "title": title[:255],
            "description": description[:2000],
            "photo_url": photo_url,
            "source_name": first_text(recipe_data.get("author")).strip()[:255],
            "source_url": source_url,
            "servings": servings,
            "notes": "Imported from recipe URL.",
            "ingredients": ingredients,
            "steps": steps,
            "components": [],
            "category_ids": [],
            "tag_ids": [],
        }
    )


def recipe_payload_from_html(html: str, source_url: str) -> CreateRecipeRequest:
    parser = JsonLdParser()
    parser.feed(html)
    for block in parser.blocks:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        recipe_data = find_recipe_json_ld(data)
        if recipe_data is not None:
            return recipe_payload_from_json_ld(recipe_data, source_url)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No Recipe JSON-LD metadata found at URL.")


def fetch_recipe_payload_from_url(url: str) -> CreateRecipeRequest:
    _validate_import_url(url)
    request = urllib.request.Request(url, headers={"User-Agent": RECIPE_IMPORT_USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=RECIPE_IMPORT_TIMEOUT_SECONDS) as response:
            headers = getattr(response, "headers", None)
            charset = "utf-8"
            if headers is not None and hasattr(headers, "get_content_charset"):
                charset = headers.get_content_charset() or "utf-8"
            html = response.read(MAX_RECIPE_IMPORT_BYTES).decode(charset, errors="replace")
    except Exception as exc:  # noqa: BLE001 - convert network/parser failures to API errors.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not fetch recipe URL.") from exc

    return recipe_payload_from_html(html, url)


def _validate_import_url(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe URL is not allowed.")

    host = parsed.hostname
    _reject_unsafe_host(host)
    try:
        resolved = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
    except OSError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not resolve recipe URL.") from exc
    for *_, sockaddr in resolved:
        address = str(sockaddr[0])
        _reject_unsafe_host(address)


def _reject_unsafe_host(host: str) -> None:
    if host.lower() == "localhost":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe URL host is not allowed.")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe URL host is not allowed.")
