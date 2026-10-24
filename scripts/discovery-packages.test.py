"""Run with .venv/bin/python scripts/discovery-packages.test.py."""

import importlib.util
import pathlib
import json
import shutil
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name("discovery-packages.py")
spec = importlib.util.spec_from_file_location("package_cli", SCRIPT)
cli = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cli)
ROOT = SCRIPT.parent.parent / "docs/examples/discovery-packages"


class PackageCliTests(unittest.TestCase):
    def test_examples_are_valid_and_reproducible(self):
        for name in ("spring-force", "pendulum-period"):
            with self.subTest(name=name):
                first = cli.build_archive(ROOT / name)
                self.assertEqual(first, cli.build_archive(ROOT / name))
                result = cli.validate(first)
                self.assertEqual(result["manifest"]["package_id"], name)

    def test_undeclared_file_is_not_silently_packaged(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = pathlib.Path(tmp)
            (target / "manifest.json").write_bytes(
                (ROOT / "spring-force/manifest.json").read_bytes()
            )
            (target / "secret.txt").write_text("Do not ship")
            with self.assertRaisesRegex(ValueError, "Unlisted"):
                cli.build_archive(target)

    def test_checksum_tampering_is_rejected(self):
        from fastapi import HTTPException

        with tempfile.TemporaryDirectory() as tmp:
            target = pathlib.Path(tmp) / "source"
            shutil.copytree(ROOT / "pendulum-period", target)
            (target / "pendulum.js").write_text("self.onmessage = () => {};\n")
            with self.assertRaises(HTTPException):
                cli.build_archive(target)

    def test_schema_snapshot_matches_server(self):
        from app.schemas.discovery_packages import PackageManifest

        snapshot = json.loads(
            (SCRIPT.parent.parent / "docs/discovery-package.schema.json").read_text()
        )
        self.assertEqual(snapshot, PackageManifest.model_json_schema())

    def test_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = pathlib.Path(tmp)
            (target / "manifest.json").symlink_to(ROOT / "spring-force/manifest.json")
            with self.assertRaisesRegex(ValueError, "Symlink"):
                cli.build_archive(target)


if __name__ == "__main__":
    unittest.main()
