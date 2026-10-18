#!/usr/bin/env python3
"""Focused source tests for the public Forge synthetic image fixture."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/build_forge_synthetic_image.py"
SPEC = importlib.util.spec_from_file_location("forge_synthetic_image", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
fixture = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fixture)


class ForgeSyntheticImageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="afyx-fixture-test-")
        self.root = Path(self.temporary.name)
        self.compiler = Path("/usr/bin/gcc")

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def build(self, name: str = "forge-synthetic-cell") -> Path:
        output = self.root / name
        fixture.build_fixture(self.compiler, output)
        return output

    def test_fixture_build_is_reproducible_static_x86_64(self) -> None:
        first = self.build("first")
        second = self.build("second")
        self.assertEqual(
            fixture.verify_elf_x86_64(first), fixture.verify_elf_x86_64(second)
        )
        argv = fixture.compiler_argv(self.compiler, first)
        self.assertIn("-static", argv)
        self.assertNotIn("-march=native", argv)

    def test_fixture_emits_exact_bounded_public_streams(self) -> None:
        executable = self.build()
        completed = subprocess.run(
            (str(executable), "--mode", "public-synthetic"),
            capture_output=True,
            check=False,
            timeout=5,
        )
        self.assertEqual(completed.returncode, 0)
        self.assertEqual(completed.stdout, fixture.EXPECTED_STDOUT)
        self.assertEqual(completed.stderr, fixture.EXPECTED_STDERR)

    def test_fixture_rejects_argument_drift(self) -> None:
        executable = self.build()
        for arguments in ((), ("--mode",), ("--mode", "other"), ("extra",)):
            with self.subTest(arguments=arguments):
                completed = subprocess.run(
                    (str(executable), *arguments),
                    capture_output=True,
                    check=False,
                    timeout=5,
                )
                self.assertEqual(completed.returncode, 64)
                self.assertEqual(completed.stdout, b"")
                self.assertEqual(completed.stderr, fixture.EXPECTED_ARGUMENT_ERROR)

    def test_fixture_syscalls_are_present_in_frozen_seccomp_allowlist(self) -> None:
        profile = json.loads(
            (ROOT / "evals/forge/policies/synthetic-seccomp-v1.json").read_text(
                "utf-8"
            )
        )
        allowed = {
            name
            for rule in profile["syscalls"]
            if rule["action"] == "SCMP_ACT_ALLOW"
            for name in rule["names"]
        }
        self.assertTrue({"write", "exit_group"} <= allowed)

    def test_containerfile_is_scratch_non_root_and_fixed(self) -> None:
        text = fixture.CONTAINERFILE.read_text("utf-8")
        fixture.validate_containerfile(text)
        self.assertEqual(text.count("FROM "), 1)
        self.assertNotIn("latest", text)

    def test_containerfile_drift_is_rejected(self) -> None:
        original = fixture.CONTAINERFILE.read_text("utf-8")
        for changed in (
            original.replace("FROM scratch", "FROM alpine"),
            original + "\nRUN true\n",
            original.replace("USER 65532:65532", "USER 0:0"),
        ):
            with self.subTest(changed=changed), self.assertRaises(
                fixture.FixtureBuildError
            ):
                fixture.validate_containerfile(changed)

    def test_image_metadata_yields_only_verified_pinned_reference(self) -> None:
        digest = "a" * 64
        result = fixture.verify_image_metadata(
            {
                "Id": "sha256:" + "b" * 64,
                "Architecture": "amd64",
                "Os": "linux",
                "RepoDigests": ["registry.example.invalid/afyx/forge@sha256:" + digest],
                "Config": {
                    "User": "65532:65532",
                    "Entrypoint": ["/opt/afyx/bin/forge-synthetic-cell"],
                    "Cmd": ["--mode", "public-synthetic"],
                },
            }
        )
        self.assertEqual(
            result["launcher_references"],
            ["registry.example.invalid/afyx/forge@sha256:" + digest],
        )

    def test_image_metadata_drift_is_rejected(self) -> None:
        base = {
            "Id": "sha256:" + "b" * 64,
            "Architecture": "amd64",
            "Os": "linux",
            "RepoDigests": [],
            "Config": {
                "User": "65532:65532",
                "Entrypoint": ["/opt/afyx/bin/forge-synthetic-cell"],
                "Cmd": ["--mode", "public-synthetic"],
            },
        }
        for key, value in (
            ("Architecture", "arm64"),
            ("Os", "windows"),
            ("Id", "not-a-digest"),
        ):
            changed = dict(base)
            changed[key] = value
            with self.subTest(key=key), self.assertRaises(fixture.FixtureBuildError):
                fixture.verify_image_metadata(changed)
        changed = dict(base)
        changed["Config"] = dict(base["Config"], User="0:0")
        with self.assertRaises(fixture.FixtureBuildError):
            fixture.verify_image_metadata(changed)


if __name__ == "__main__":
    unittest.main()
