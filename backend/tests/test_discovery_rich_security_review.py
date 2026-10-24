"""Independent resource-boundary review; tiny animation fixtures, never memory bombs."""

import hashlib
import io
import pytest
from fastapi import HTTPException
from PIL import Image
from app.services.discovery.packages import validate_archive
from test_discovery_packages import archive, manifest


@pytest.mark.parametrize(
    "format,mime,path",
    [("PNG", "image/png", "image.png"), ("WEBP", "image/webp", "image.webp")],
)
def test_animated_rasters_cannot_bypass_single_frame_pixel_budget(format, mime, path):
    image = io.BytesIO()
    Image.new("RGBA", (4, 4), "red").save(
        image,
        format=format,
        save_all=True,
        append_images=[Image.new("RGBA", (4, 4), "blue")],
        duration=100,
        loop=0,
    )
    data = image.getvalue()
    with Image.open(io.BytesIO(data)) as check:
        assert check.is_animated and check.n_frames == 2
    value = manifest()
    value.pop("scene")
    value["runtime"] = "worker-rich-v1"
    value["entry"] = "main.js"
    source = b'onmessage=()=>postMessage({description:"Test",shapes:[],controls:[]})'
    value["assets"] = [
        {
            "path": "main.js",
            "mime_type": "text/javascript",
            "sha256": hashlib.sha256(source).hexdigest(),
        },
        {"path": path, "mime_type": mime, "sha256": hashlib.sha256(data).hexdigest()},
    ]
    with pytest.raises(HTTPException, match="animated|Animated|frame|Frame"):
        validate_archive(archive(value, [("main.js", source), (path, data)]))
