"""The new rich capability is explicit; legacy source budgets remain unchanged."""

import hashlib
import random
import io
from PIL import Image

import pytest
from fastapi import HTTPException
from app.services.discovery.packages import validate_archive
from test_discovery_packages import archive, manifest


def worker_archive(runtime, size):
    rng = random.Random(42)
    # Bounded incompressible printable source fixture, not a compression bomb.
    source = "//" + "".join(rng.choices("abcdef0123456789", k=size - 2))
    value = manifest()
    value.pop("scene")
    value.update(runtime=runtime, entry="worker.js")
    value["assets"] = [
        {
            "path": "worker.js",
            "mime_type": "text/javascript",
            "sha256": hashlib.sha256(source.encode()).hexdigest(),
        }
    ]
    return archive(value, [("worker.js", source)])


def test_rich_worker_capability_accepts_bounded_self_contained_engine():
    result = validate_archive(worker_archive("worker-rich-v1", 300_000))
    assert result["manifest"]["runtime"] == "worker-rich-v1"


@pytest.mark.parametrize("runtime", ["worker-v1", "worker-3d-v1"])
def test_legacy_worker_source_budget_does_not_expand(runtime):
    with pytest.raises(HTTPException):
        validate_archive(worker_archive(runtime, 262_145))


def test_rich_worker_source_remains_bounded():
    with pytest.raises(HTTPException):
        validate_archive(worker_archive("worker-rich-v1", 1_048_577))


@pytest.mark.parametrize(
    "runtime, accepted", [("worker-rich-v1", True), ("worker-v1", False)]
)
def test_larger_local_asset_collection_is_explicitly_rich_only(runtime, accepted):
    rng = random.Random(123)
    value = manifest()
    value.pop("scene")
    value.update(runtime=runtime, entry="worker.js")
    files = [("worker.js", "self.onmessage=()=>{};")]
    # Seven incompressible text assets model a multi-map package's storage size.
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    files += [
        (f"map-{i}.txt", "".join(rng.choices(alphabet, k=700_000))) for i in range(7)
    ]
    value["assets"] = [
        {
            "path": path,
            "mime_type": "text/javascript" if path.endswith(".js") else "text/plain",
            "sha256": hashlib.sha256(data.encode()).hexdigest(),
        }
        for path, data in files
    ]
    if accepted:
        assert validate_archive(archive(value, files))["manifest"]["runtime"] == runtime
    else:
        with pytest.raises(HTTPException):
            validate_archive(archive(value, files))


def test_rich_collection_rejects_aggregate_decoded_image_budget():
    image = Image.new("RGB", (2048, 1024), "orange")
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=80)
    data = buffer.getvalue()
    value = manifest()
    value.pop("scene")
    value.update(runtime="worker-rich-v1", entry="worker.js")
    files = [("worker.js", b"self.onmessage=()=>{};")]
    files += [(f"texture-{i}.jpg", data) for i in range(9)]
    value["assets"] = [
        {
            "path": name,
            "mime_type": "text/javascript" if name.endswith(".js") else "image/jpeg",
            "sha256": hashlib.sha256(content).hexdigest(),
        }
        for name, content in files
    ]
    with pytest.raises(HTTPException, match="Aggregate image pixel"):
        validate_archive(archive(value, files))
