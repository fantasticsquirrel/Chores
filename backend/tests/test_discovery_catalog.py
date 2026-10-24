import json
from pathlib import Path
import pytest
from app.services import discovery


def test_catalog_has_complete_unique_stable_content():
    discovery.catalog.cache_clear()
    entries = discovery.catalog()
    assert {entry["id"] for entry in entries} == {
        "orbital-mechanics",
        "reflection-refraction",
        "gravity",
        "solar-system",
        "moon-phases",
        "photosynthesis",
        "castle-defenses",
        "sound-playground",
        "bridge-builder",
        "river-sculptor",
        "circuit-city",
        "food-web-rescue",
        "fraction-feast",
        "pattern-palace",
        "caravan-crossroads",
        "pollinator-express",
        "chance-carnival",
        "machine-workshop",
        "heat-house",
        "pressure-tank",
        "moving-plates",
        "cloud-rain-lab",
        "magnetic-fields",
        "cell-explorer",
        "shape-slicer",
        "adaptation-island",

    }
    assert all(entry["experiments"] and entry["sources"] for entry in entries)


@pytest.mark.parametrize(
    "mutation",
    [
        "missing-title",
        "invalid-id",
        "empty-grades",
        "bad-grade",
        "duplicate-id",
        "unknown-field",
    ],
)
def test_invalid_registry_fails_early_with_clear_error(
    tmp_path: Path, monkeypatch, mutation
):
    entries = json.loads(discovery.REGISTRY_PATH.read_text())
    if mutation == "missing-title":
        del entries[0]["title"]
    elif mutation == "invalid-id":
        entries[0]["id"] = "../unsafe"
    elif mutation == "empty-grades":
        entries[0]["grade_bands"] = []
    elif mutation == "bad-grade":
        entries[0]["grade_bands"] = ["college"]
    elif mutation == "duplicate-id":
        entries.append(entries[0])
    else:
        entries[0]["child_name"] = "not a content field"
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(entries))
    monkeypatch.setattr(discovery, "REGISTRY_PATH", path)
    discovery.catalog.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="Invalid Discovery Lab registry"):
            discovery.catalog()
    finally:
        discovery.catalog.cache_clear()
