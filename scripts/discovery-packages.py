#!/usr/bin/env python3
"""Create reproducible Discovery ZIPs; validate using the server's exact rules."""

import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))


def validate(archive: bytes) -> dict:
    from app.services.discovery.packages import validate_archive

    return validate_archive(base64.b64encode(archive).decode("ascii"))


def source_files(directory: Path) -> dict[str, Path]:
    directory = directory.resolve(strict=True)
    files = {}
    for path in sorted(directory.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Symlink is not allowed: {path.name}")
        if path.is_file():
            files[path.relative_to(directory).as_posix()] = path
    return files


def build_archive(directory: Path) -> bytes:
    files = source_files(directory)
    manifest = json.loads(files["manifest.json"].read_text(encoding="utf-8"))
    expected = {"manifest.json", *(asset["path"] for asset in manifest["assets"])}
    if set(files) != expected:
        raise ValueError(f"Unlisted or missing files: {sorted(set(files) ^ expected)}")
    output = io.BytesIO()
    with zipfile.ZipFile(
        output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
    ) as archive:
        for name, path in sorted(files.items()):
            entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(
                entry,
                path.read_bytes(),
                compress_type=zipfile.ZIP_DEFLATED,
                compresslevel=9,
            )
    result = output.getvalue()
    validate(result)
    return result


def refresh_checksums(directory: Path):
    files = source_files(directory)
    manifest_path = files["manifest.json"]
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for asset in manifest["assets"]:
        # Resolve through the enumerated source map, never a manifest-supplied path.
        asset["sha256"] = hashlib.sha256(files[asset["path"]].read_bytes()).hexdigest()
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser(
        "build", help="Validate source and write deterministic ZIP"
    )
    build.add_argument("source", type=Path)
    build.add_argument("output", type=Path)
    check = commands.add_parser(
        "validate", help="Validate existing ZIP without executing code"
    )
    check.add_argument("archive", type=Path)
    checksums = commands.add_parser(
        "checksums", help="Explicitly update listed asset SHA-256 values"
    )
    checksums.add_argument("source", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "checksums":
            refresh_checksums(args.source)
            print("Updated declared asset checksums; run build to validate.")
            return
        if args.command == "build":
            if args.output.resolve().is_relative_to(args.source.resolve()):
                raise ValueError("Write the archive outside its source directory.")
            archive = build_archive(args.source)
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_bytes(archive)
        else:
            if args.archive.stat().st_size > 8 * 1024 * 1024:
                raise ValueError("Archive exceeds 8 MiB.")
            archive = args.archive.read_bytes()
        result = validate(archive)
        manifest = result["manifest"]
        print(
            f"Valid: {manifest['package_id']} {manifest['version']} ({manifest['runtime']})"
        )
        print(f"ZIP SHA-256: {hashlib.sha256(archive).hexdigest()}")
    except Exception as exc:
        print(f"Package error: {getattr(exc, 'detail', str(exc))}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
