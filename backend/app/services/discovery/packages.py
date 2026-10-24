"""Bounded ZIP ingestion and household-scoped immutable package storage.

Archives are never extracted or executed. No URL is fetched during validation.
"""

import base64
import binascii
import hashlib
import io
import json
import re
import stat
import warnings
import zipfile
from fastapi import HTTPException
from PIL import Image
from pydantic import ValidationError
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session
from app.models.discovery import (
    DiscoveryPackage,
    DiscoveryPackageVersion,
    DiscoveryPackageGrant,
)
from app.schemas.discovery_packages import PackageManifest

MAX_ARCHIVE = 2 * 1024 * 1024
MAX_TOTAL = 4 * 1024 * 1024
MAX_FILE = 1024 * 1024
MIME_EXTENSIONS = {
    "text/javascript": {".js"},
    "application/json": {".json"},
    "text/plain": {".txt"},
    "image/png": {".png"},
    "image/jpeg": {".jpg", ".jpeg"},
    "image/webp": {".webp"},
}


def invalid(message):
    return HTTPException(status_code=422, detail=f"Invalid package: {message}")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key.")
        result[key] = value
    return result


def json_document(data):
    return json.loads(
        data.decode("utf-8"),
        object_pairs_hook=unique_object,
        parse_constant=lambda value: (_ for _ in ()).throw(
            ValueError("Nonfinite JSON number.")
        ),
    )


def safe_path(path):
    return (
        bool(re.fullmatch(r"[A-Za-z0-9_-]+(?:[./][A-Za-z0-9_-]+)*\.[a-z0-9]+", path))
        and ".." not in path
        and len(path) <= 160
    )


def validate_archive(encoded: str) -> dict:
    """Return normalized {manifest, assets, checksum}; raise HTTPException(422)."""
    if len(encoded) > 2796204:
        raise invalid("Archive exceeds 2 MiB.")
    try:
        raw = base64.b64decode(encoded, validate=True)
        if not raw or len(raw) > MAX_ARCHIVE:
            raise ValueError("Archive exceeds 2 MiB or is empty.")
        files = {}
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            infos = archive.infolist()
            if not 1 <= len(infos) <= 32:
                raise ValueError("Archive must contain 1 to 32 files.")
            if sum(info.file_size for info in infos) > MAX_TOTAL:
                raise ValueError("Expanded archive exceeds 4 MiB.")
            for info in infos:
                mode = info.external_attr >> 16
                if (
                    not safe_path(info.filename)
                    or info.filename != info.orig_filename
                    or info.filename in files
                    or info.is_dir()
                    or info.flag_bits & 1
                    or stat.S_ISLNK(mode)
                    or stat.S_IFMT(mode) not in (0, stat.S_IFREG)
                    or info.compress_type
                    not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
                ):
                    raise ValueError(
                        "Unsafe, duplicate, encrypted, or unsupported archive entry."
                    )
                limit = 128 * 1024 if info.filename == "manifest.json" else MAX_FILE
                if (
                    info.file_size > limit
                    or info.file_size > max(info.compress_size, 1) * 100
                ):
                    raise ValueError("File exceeds size or compression ratio limit.")
                with archive.open(info) as stream:
                    value = stream.read(limit + 1)
                if len(value) > limit or len(value) != info.file_size:
                    raise ValueError("File size mismatch.")
                files[info.filename] = value
        if "manifest.json" not in files:
            raise ValueError("manifest.json is required at archive root.")
        manifest = PackageManifest.model_validate(json_document(files["manifest.json"]))
        expected = {asset.path for asset in manifest.assets} | {"manifest.json"}
        if set(files) != expected or any(
            asset.path == "manifest.json" for asset in manifest.assets
        ):
            raise ValueError("Archive files must exactly match declared assets.")
        assets = []
        for asset in manifest.assets:
            data = files[asset.path]
            if asset.path == manifest.entry and len(data) > 262144:
                raise ValueError("Worker entry exceeds 256 KiB.")
            extension = "." + asset.path.rsplit(".", 1)[-1]
            if extension not in MIME_EXTENSIONS[asset.mime_type]:
                raise ValueError("Asset MIME type does not match extension.")
            if hashlib.sha256(data).hexdigest() != asset.sha256:
                raise ValueError("Asset checksum mismatch.")
            if asset.mime_type.startswith("image/"):
                with warnings.catch_warnings():
                    warnings.simplefilter("error", Image.DecompressionBombWarning)
                    with Image.open(io.BytesIO(data)) as image:
                        if (
                            image.width * image.height > 4_000_000
                            or image.format
                            != {
                                "image/png": "PNG",
                                "image/jpeg": "JPEG",
                                "image/webp": "WEBP",
                            }[asset.mime_type]
                        ):
                            raise ValueError("Image dimensions or format invalid.")
                        image.verify()
            else:
                text = data.decode("utf-8")
                if "\x00" in text:
                    raise ValueError("Text assets cannot contain NUL.")
                if asset.mime_type == "application/json":
                    json_document(data)
            assets.append(
                {
                    **asset.model_dump(),
                    "content_base64": base64.b64encode(data).decode("ascii"),
                }
            )
        return {
            "manifest": manifest.model_dump(exclude_none=True),
            "assets": assets,
            "checksum": hashlib.sha256(raw).hexdigest(),
        }
    except (
        ValueError,
        TypeError,
        UnicodeError,
        binascii.Error,
        zipfile.BadZipFile,
        NotImplementedError,
        RuntimeError,
        OSError,
        RecursionError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        ValidationError,
    ) as exc:
        raise invalid(str(exc)[:400]) from exc


def version_row(session: Session, household_id: int, package_id: str, version: str):
    row = session.get(DiscoveryPackageVersion, (household_id, package_id, version))
    if row is None:
        raise HTTPException(status_code=404, detail="Package version not found.")
    return row


def summary(session, row):
    package = session.get(DiscoveryPackage, (row.household_id, row.package_id))
    return {
        "package_id": row.package_id,
        "version": row.version,
        "runtime": row.runtime,
        "checksum": row.checksum,
        "published": package.published_version == row.version,
        "created_at": row.created_at,
    }


def store_package(session, household_id, payload):
    manifest = payload["manifest"]
    key = (household_id, manifest["package_id"])
    if session.get(DiscoveryPackageVersion, (*key, manifest["version"])):
        raise HTTPException(
            status_code=409,
            detail="Package versions are immutable; choose a new version.",
        )
    from app.services.discovery import catalog

    if manifest["package_id"] in {entry["id"] for entry in catalog()}:
        raise invalid("Package ID conflicts with a bundled exploration.")
    if (
        session.scalar(
            select(func.count())
            .select_from(DiscoveryPackageVersion)
            .where(DiscoveryPackageVersion.household_id == household_id)
        )
        >= 100
    ):
        raise HTTPException(
            status_code=409, detail="Household package version limit reached (100)."
        )
    if session.get(DiscoveryPackage, key) is None:
        session.add(DiscoveryPackage(household_id=household_id, package_id=key[1]))
        session.flush()
    row = DiscoveryPackageVersion(
        household_id=household_id,
        package_id=key[1],
        version=manifest["version"],
        runtime=manifest["runtime"],
        checksum=payload["checksum"],
        payload_json=json.dumps(payload),
    )
    session.add(row)
    session.flush()
    return row


def published_catalog(session, household_id):
    rows = session.scalars(
        select(DiscoveryPackageVersion)
        .join(
            DiscoveryPackage,
            (DiscoveryPackage.household_id == DiscoveryPackageVersion.household_id)
            & (DiscoveryPackage.package_id == DiscoveryPackageVersion.package_id)
            & (DiscoveryPackage.published_version == DiscoveryPackageVersion.version),
        )
        .where(DiscoveryPackageVersion.household_id == household_id)
        .order_by(DiscoveryPackageVersion.package_id)
    )
    return tuple(
        {
            **json.loads(row.payload_json)["manifest"]["exploration"],
            "package": {
                "version": row.version,
                "runtime": row.runtime,
                "checksum": row.checksum,
            },
        }
        for row in rows
    )


def publish(session, row):
    package = session.get(DiscoveryPackage, (row.household_id, row.package_id))
    if package.published_version != row.version:
        session.execute(
            delete(DiscoveryPackageGrant).where(
                DiscoveryPackageGrant.household_id == row.household_id,
                DiscoveryPackageGrant.package_id == row.package_id,
            )
        )
        package.published_version = row.version
    session.flush()
